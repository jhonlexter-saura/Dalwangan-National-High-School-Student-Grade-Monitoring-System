const Student = require("../models/Student");
const Class = require("../models/Class");
const User = require("../models/User");
const Teacher = require("../models/Teacher");
const { logAudit } = require("../services/auditLogger");
const {
  notifyStudentsOfEnrollment,
  notifyStudentIdsOfEnrollment,
  syncStudentClassDetails,
  addStudentsAtomically,
  addStudentAtomically,
} = require("../services/enrollmentService");
const { validateStudentProfile } = require("../middleware/validators/studentValidation");

/* ---------- helpers (used only by this controller) ---------- */

const classLabel = (classData) => `${classData.name} · Section ${classData.section}`;

const teacherOwnsClass = (teacher, classData) =>
  classData.teacher.toString() === teacher._id.toString();

// Shared by both batch routes (admin and teacher). Sends the response itself,
// then writes the audit entry, exactly as the original did.
async function enrollBatch(req, res, classId, classData, studentIds) {
  const existingIds = new Set((classData.students || []).map((id) => id.toString()));

  const idsToAdd = [];
  for (const sid of studentIds) {
    const student = await Student.findById(sid);
    if (student && !existingIds.has(student._id.toString())) {
      idsToAdd.push(student._id);
      existingIds.add(student._id.toString());
    }
  }

  const newlyAddedIds = idsToAdd.length > 0 ? await addStudentsAtomically(classId, idsToAdd) : [];
  if (newlyAddedIds.length > 0) {
    await syncStudentClassDetails(newlyAddedIds, classData);
    await notifyStudentIdsOfEnrollment(newlyAddedIds, classData);
  }

  const updatedClass = await Class.findById(classId).populate("teacher").populate("students");

  res.json({
    message: `${newlyAddedIds.length} student(s) added successfully`,
    class: updatedClass,
    addedCount: newlyAddedIds.length,
  });

  if (newlyAddedIds.length > 0) {
    logAudit({
      req,
      action: "STUDENTS_ENROLLED",
      category: "students",
      target: { entityType: "Class", entityId: String(classData._id), name: classLabel(classData) },
      description: `Enrolled ${newlyAddedIds.length} student(s) in ${classData.name} (${classData.section})`,
      details: {
        classId: classData._id,
        className: classData.name,
        studentIds: newlyAddedIds.map(String),
        addedCount: newlyAddedIds.length,
      },
    });
  }
}

// Shared by both single-enroll routes. Returns true if enrolled, or sends the 409 and returns false.
async function enrollOne(res, classData, student) {
  const alreadyEnrolled = classData.students.some(
    (id) => id.toString() === student._id.toString()
  );
  if (alreadyEnrolled) {
    res.status(409).json({ error: "Student is already enrolled in this class" });
    return false;
  }

  const enrolled = await addStudentAtomically(classData._id, student._id);
  if (!enrolled) {
    res.status(409).json({ error: "Student is already enrolled in this class" });
    return false;
  }
  await syncStudentClassDetails([student._id], classData);
  await notifyStudentsOfEnrollment([student], classData);
  return true;
}

/* ---------- reads ---------- */

async function getStudents(req, res) {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error.message);
    res.status(500).json({ error: "Failed to fetch students" });
  }
}

async function getStudent(req, res) {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    res.json(student);
  } catch (error) {
    console.error("Error fetching student:", error.message);
    res.status(500).json({ error: "Failed to fetch student" });
  }
}

/* ---------- student records ---------- */

// PATCH /:id/status (admin; ID + status validated by middleware)
async function updateStudentStatus(req, res) {
  try {
    const status = req.studentStatus;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (student.user) {
      const user = await User.findOne({ _id: student.user, role: "student" });
      if (!user) {
        return res
          .status(409)
          .json({ error: "The linked student login account could not be found" });
      }
      user.status = status;
      await user.save();
    }

    student.status = status;
    await student.save();

    logAudit({
      req,
      action: "STUDENT_STATUS_CHANGED",
      category: "students",
      target: { entityType: "Student", entityId: String(student._id), name: student.name },
      description: `Updated status for student '${student.name}' to ${status}`,
      details: { studentId: student.studentId, name: student.name, newStatus: status },
    });

    return res.json(student);
  } catch (error) {
    console.error("Update student account status error:", error);
    return res.status(500).json({ error: "Failed to update student account status" });
  }
}

// PATCH /:id (admin): updates the profile and syncs the linked login account
async function updateStudentProfile(req, res) {
  try {
    const updates = req.profileUpdates;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const previousProfile = {
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      gradeLevel: student.gradeLevel,
      section: student.section,
      schoolYear: student.schoolYear,
    };

    // Fields that were not sent keep their stored values.
    const merged = {
      studentId: updates.studentId ?? student.studentId,
      name: updates.name ?? student.name,
      email: updates.email ?? student.email,
      section: updates.section ?? student.section,
      schoolYear: updates.schoolYear ?? student.schoolYear,
      gradeLevel: updates.gradeLevel ?? student.gradeLevel,
    };

    const validationMessage = validateStudentProfile(merged);
    if (validationMessage) {
      return res.status(400).json({ error: validationMessage });
    }

    const { studentId, name, email, gradeLevel, section, schoolYear } = merged;

    const [duplicateStudent, duplicateAccount] = await Promise.all([
      Student.findOne({
        $or: [{ studentId }, { email }],
        _id: { $ne: student._id },
      }),
      User.findOne({
        email,
        ...(student.user ? { _id: { $ne: student.user } } : {}),
      }),
    ]);

    if (duplicateStudent) {
      return res.status(409).json({ error: "Student ID or email is already registered" });
    }
    if (duplicateAccount) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    student.studentId = studentId;
    student.name = name;
    student.email = email;
    student.gradeLevel = gradeLevel;
    student.section = section;
    student.schoolYear = schoolYear;
    await student.save();

    if (student.user) {
      await User.updateOne({ _id: student.user, role: "student" }, { $set: { name, email } });
    }

    logAudit({
      req,
      action: "STUDENT_UPDATED",
      category: "students",
      target: { entityType: "Student", entityId: String(student._id), name },
      description: `Updated student profile for ${name}`,
      details: {
        before: previousProfile,
        after: { studentId, name, email, gradeLevel, section, schoolYear },
      },
    });

    return res.json(student);
  } catch (error) {
    console.error("Update student profile error:", error);

    if (error.code === 11000) {
      return res.status(409).json({ error: "Student ID or email is already registered" });
    }
    return res.status(500).json({ error: "Failed to update student profile" });
  }
}

// POST / (body validated by middleware)
async function createStudent(req, res) {
  try {
    const { studentId, name, email, gradeLevel, section, schoolYear } = req.studentData;

    const existingStudent = await Student.findOne({ $or: [{ studentId }, { email }] });
    if (existingStudent) {
      return res.status(409).json({ error: "Student ID or email already exists" });
    }

    const student = await Student.create({
      studentId,
      name,
      email,
      gradeLevel,
      section,
      schoolYear,
    });

    logAudit({
      req,
      action: "STUDENT_CREATED",
      category: "students",
      target: { entityType: "Student", entityId: String(student._id), name: student.name },
      description: `Created student record for '${student.name}' (${student.studentId})`,
      details: {
        studentId: student.studentId,
        name: student.name,
        gradeLevel: student.gradeLevel,
        section: student.section,
      },
    });

    res.status(201).json(student);
  } catch (error) {
    console.error("Error creating student:", error.message);
    res.status(500).json({ error: "Failed to create student" });
  }
}

/* ---------- class enrollment ---------- */

// POST /batch/classes/:classId/teacher/:userId
async function batchAddToClassByTeacher(req, res) {
  try {
    const { classId, userId } = req.params;

    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }

    if (!teacherOwnsClass(teacher, classData)) {
      return res.status(403).json({ error: "You do not have permission to modify this class" });
    }

    await enrollBatch(req, res, classId, classData, req.studentIds);
  } catch (error) {
    console.error("Teacher batch add students error:", error.message);
    res.status(500).json({ error: "Failed to add students to class" });
  }
}

// POST /batch/classes/:classId
async function batchAddToClass(req, res) {
  try {
    const { classId } = req.params;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }

    await enrollBatch(req, res, classId, classData, req.studentIds);
  } catch (error) {
    console.error("Batch add students error:", error.message);
    res.status(500).json({ error: "Failed to add students to class" });
  }
}

// POST /:studentId/classes/:classId
async function addStudentToClass(req, res) {
  try {
    const { studentId, classId } = req.params;

    const student = await Student.findById(studentId);
    const classData = await Class.findById(classId);

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }

    if (!(await enrollOne(res, classData, student))) return;

    const updatedClass = await Class.findById(classId).populate("students");

    logAudit({
      req,
      action: "STUDENT_ENROLLED",
      category: "students",
      target: { entityType: "ClassRoster", entityId: String(classData._id), name: classLabel(classData) },
      description: `Enrolled student '${student.name}' in class '${classData.name}'`,
      details: {
        studentId: student._id,
        studentName: student.name,
        classId: classData._id,
        className: classData.name,
      },
    });

    res.json({ message: "Student added to class successfully", class: updatedClass });
  } catch (error) {
    console.error("Error adding student to class:", error.message);
    res.status(500).json({ error: "Failed to add student to class" });
  }
}

// POST /:studentId/classes/:classId/teacher/:userId
async function teacherAddStudentToClass(req, res) {
  try {
    const { studentId, classId, userId } = req.params;

    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }

    // Make sure this class belongs to the teacher
    if (!teacherOwnsClass(teacher, classData)) {
      return res.status(403).json({ error: "You do not have permission to modify this class" });
    }

    if (!(await enrollOne(res, classData, student))) return;

    const updatedClass = await Class.findById(classId).populate("teacher").populate("students");

    res.json({ message: "Student added to class successfully", class: updatedClass });
  } catch (error) {
    console.error("Teacher add student error:", error.message);
    res.status(500).json({ error: "Failed to add student to class" });
  }
}

// DELETE /:studentId/classes/:classId (admin; IDs validated by middleware)
async function removeStudentFromClass(req, res) {
  try {
    const { studentId, classId } = req.params;

    const classData = await Class.findById(classId);
    if (!classData) return res.status(404).json({ error: "Class not found" });

    const removed = await Class.findOneAndUpdate(
      { _id: classData._id, students: studentId },
      { $pull: { students: studentId } },
      { new: true }
    )
      .select("_id")
      .lean();
    if (!removed) {
      return res.status(404).json({ error: "Student is not enrolled in this class" });
    }

    logAudit({
      req,
      action: "STUDENT_REMOVED",
      category: "students",
      target: { entityType: "ClassRoster", entityId: String(classData._id), name: classLabel(classData) },
      description: `Removed student from class '${classData.name}'`,
      details: { studentId, classId },
    });

    return res.json({ message: "Student removed from class", classId, studentId });
  } catch (error) {
    console.error("Remove student from class error:", error.message);
    return res.status(500).json({ error: "Failed to remove student from class" });
  }
}

module.exports = {
  getStudents,
  getStudent,
  updateStudentStatus,
  updateStudentProfile,
  createStudent,
  batchAddToClassByTeacher,
  batchAddToClass,
  addStudentToClass,
  teacherAddStudentToClass,
  removeStudentFromClass,
};