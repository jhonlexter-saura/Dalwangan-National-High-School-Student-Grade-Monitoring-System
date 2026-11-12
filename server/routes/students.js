const express = require("express");
const mongoose = require("mongoose");
const Student = require("../models/Student");
const Class = require("../models/Class");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { requireAdmin } = require("../middleware/authorization");
const { logAudit } = require("../services/auditLogger");

const router = express.Router();

async function notifyStudentsOfEnrollment(students, classRecord) {
  const recipients = [...new Set(students.map((student) => student?.user).filter(Boolean).map(String))];
  if (!recipients.length) return;
  try {
    await Notification.insertMany(recipients.map((recipient) => ({
      recipient,
      type: "class_assigned",
      title: "You were added to a class",
      message: `You have been enrolled in ${classRecord.name} · Section ${classRecord.section} (Grade ${classRecord.gradeLevel}).`,
      link: "/student",
    })));
  } catch (error) {
    // Keep the enrollment successful even if creating a notification fails.
    console.error("Failed to notify students about class enrollment:", error.message);
  }
}

async function notifyStudentIdsOfEnrollment(studentIds, classRecord) {
  try {
    const students = await Student.find({ _id: { $in: studentIds } }).select("user").lean();
    await notifyStudentsOfEnrollment(students, classRecord);
  } catch (error) {
    // Notification lookup failures must not roll back a saved enrollment.
    console.error("Failed to look up enrolled student accounts:", error.message);
  }
}

async function syncStudentClassDetails(studentIds, classRecord) {
  try {
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { $set: { gradeLevel: classRecord.gradeLevel, section: classRecord.section, schoolYear: classRecord.schoolYear } }
    );
  } catch (error) {
    // Enrollment remains valid if the profile metadata update needs to be retried.
    console.error("Failed to sync student class details:", error.message);
  }
}

async function addStudentsAtomically(classId, studentIds) {
  const results = await Promise.all(studentIds.map((studentId) =>
    Class.findOneAndUpdate(
      { _id: classId, students: { $ne: studentId } },
      { $addToSet: { students: studentId } },
      { new: true }
    ).select("_id").lean()
  ));
  return studentIds.filter((_, index) => Boolean(results[index]));
}

async function addStudentAtomically(classId, studentId) {
  return Class.findOneAndUpdate(
    { _id: classId, students: { $ne: studentId } },
    { $addToSet: { students: studentId } },
    { new: true }
  ).select("_id").lean();
}

// GET all students
router.get("/", async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });

    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error.message);
    res.status(500).json({
      error: "Failed to fetch students",
    });
  }
});

// GET one student
router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    res.json(student);
  } catch (error) {
    console.error("Error fetching student:", error.message);
    res.status(500).json({
      error: "Failed to fetch student",
    });
  }
});

router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }
    const { status } = req.body || {};
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ error: "Status must be active or inactive" });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (student.user) {
      const user = await User.findOne({ _id: student.user, role: "student" });
      if (!user) {
        return res.status(409).json({
          error: "The linked student login account could not be found",
        });
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
      target: {
        entityType: "Student",
        entityId: String(student._id),
        name: student.name,
      },
      description: `Updated status for student '${student.name}' to ${status}`,
      details: { studentId: student.studentId, name: student.name, newStatus: status },
    });

    return res.json(student);
  } catch (error) {
    console.error("Update student account status error:", error);
    return res.status(500).json({
      error: "Failed to update student account status",
    });
  }
});

// UPDATE a student profile and synchronize its linked login account, if present.
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "A profile update is required" });
    }

    if (
      Object.hasOwn(req.body, "role") ||
      Object.hasOwn(req.body, "password") ||
      Object.hasOwn(req.body, "status") ||
      Object.hasOwn(req.body, "user")
    ) {
      return res.status(400).json({
        error: "Role, status, password, and account links cannot be changed here",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }

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

    const studentId =
      typeof req.body.studentId === "string"
        ? req.body.studentId.trim()
        : student.studentId;
    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : student.name;
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : student.email;
    const section =
      typeof req.body.section === "string"
        ? req.body.section.trim()
        : student.section;
    const schoolYear =
      typeof req.body.schoolYear === "string"
        ? req.body.schoolYear.trim()
        : student.schoolYear;
    const gradeLevel =
      req.body.gradeLevel === undefined
        ? student.gradeLevel
        : Number(req.body.gradeLevel);

    if (!studentId || !name || !email || !section || !schoolYear) {
      return res.status(400).json({
        error: "Student ID, name, email, grade level, section, and school year are required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }

    if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
      return res.status(400).json({
        error: "Grade level must be between 7 and 12",
      });
    }

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
      return res.status(409).json({
        error: "Student ID or email is already registered",
      });
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
      await User.updateOne(
        { _id: student.user, role: "student" },
        { $set: { name, email } }
      );
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
      return res.status(409).json({
        error: "Student ID or email is already registered",
      });
    }

    return res.status(500).json({
      error: "Failed to update student profile",
    });
  }
});

// CREATE student
router.post("/", async (req, res) => {
  try {
    const {
      studentId,
      name,
      email,
      gradeLevel,
      section,
      schoolYear,
    } = req.body;

    if (
      !studentId ||
      !name ||
      !email ||
      !gradeLevel ||
      !section ||
      !schoolYear
    ) {
      return res.status(400).json({
        error: "All student fields are required",
      });
    }

    const existingStudent = await Student.findOne({
      $or: [{ studentId }, { email }],
    });

    if (existingStudent) {
      return res.status(409).json({
        error: "Student ID or email already exists",
      });
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
      target: {
        entityType: "Student",
        entityId: String(student._id),
        name: student.name,
      },
      description: `Created student record for '${student.name}' (${student.studentId})`,
      details: { studentId: student.studentId, name: student.name, gradeLevel: student.gradeLevel, section: student.section },
    });

    res.status(201).json(student);
  } catch (error) {
    console.error("Error creating student:", error.message);
    res.status(500).json({
      error: "Failed to create student",
    });
  }
});

// BATCH ADD STUDENTS TO CLASS (TEACHER)
router.post(
  "/batch/classes/:classId/teacher/:userId",
  async (req, res) => {
    try {
      const { classId, userId } = req.params;
      const { studentIds } = req.body;

      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
          error: "studentIds array is required",
        });
      }

      const Teacher = require("../models/Teacher");
      const teacher = await Teacher.findOne({
        user: userId,
      });

      if (!teacher) {
        return res.status(404).json({
          error: "Teacher profile not found",
        });
      }

      const classData = await Class.findById(classId);

      if (!classData) {
        return res.status(404).json({
          error: "Class not found",
        });
      }

      if (
        classData.teacher.toString() !==
        teacher._id.toString()
      ) {
        return res.status(403).json({
          error: "You do not have permission to modify this class",
        });
      }

      const existingIds = new Set(
        (classData.students || []).map((id) => id.toString())
      );

      const idsToAdd = [];
      for (const sid of studentIds) {
        const student = await Student.findById(sid);
        if (student && !existingIds.has(student._id.toString())) {
          idsToAdd.push(student._id);
          existingIds.add(student._id.toString());
        }
      }

      const newlyAddedIds = idsToAdd.length > 0
        ? await addStudentsAtomically(classId, idsToAdd)
        : [];
      if (newlyAddedIds.length > 0) {
        await syncStudentClassDetails(newlyAddedIds, classData);
        await notifyStudentIdsOfEnrollment(newlyAddedIds, classData);
      }

      const updatedClass = await Class.findById(classId)
        .populate("teacher")
        .populate("students");

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
          target: { entityType: "Class", entityId: String(classData._id), name: `${classData.name} · Section ${classData.section}` },
          description: `Enrolled ${newlyAddedIds.length} student(s) in ${classData.name} (${classData.section})`,
          details: { classId: classData._id, className: classData.name, studentIds: newlyAddedIds.map(String), addedCount: newlyAddedIds.length },
        });
      }
    } catch (error) {
      console.error(
        "Teacher batch add students error:",
        error.message
      );

      res.status(500).json({
        error: "Failed to add students to class",
      });
    }
  }
);

// BATCH ADD STUDENTS TO CLASS (ADMIN)
router.post("/batch/classes/:classId", async (req, res) => {
  try {
    const { classId } = req.params;
    const { studentIds } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        error: "studentIds array is required",
      });
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        error: "Class not found",
      });
    }

    const existingIds = new Set(
      (classData.students || []).map((id) => id.toString())
    );

    const idsToAdd = [];
    for (const sid of studentIds) {
      const student = await Student.findById(sid);
      if (student && !existingIds.has(student._id.toString())) {
        idsToAdd.push(student._id);
        existingIds.add(student._id.toString());
      }
    }

    const newlyAddedIds = idsToAdd.length > 0
      ? await addStudentsAtomically(classId, idsToAdd)
      : [];
    if (newlyAddedIds.length > 0) {
      await syncStudentClassDetails(newlyAddedIds, classData);
      await notifyStudentIdsOfEnrollment(newlyAddedIds, classData);
    }

    const updatedClass = await Class.findById(classId)
      .populate("teacher")
      .populate("students");

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
        target: { entityType: "Class", entityId: String(classData._id), name: `${classData.name} · Section ${classData.section}` },
        description: `Enrolled ${newlyAddedIds.length} student(s) in ${classData.name} (${classData.section})`,
        details: { classId: classData._id, className: classData.name, studentIds: newlyAddedIds.map(String), addedCount: newlyAddedIds.length },
      });
    }
  } catch (error) {
    console.error(
      "Batch add students error:",
      error.message
    );

    res.status(500).json({
      error: "Failed to add students to class",
    });
  }
});

// ADD STUDENT TO CLASS
router.post("/:studentId/classes/:classId", async (req, res) => {
  try {
    const { studentId, classId } = req.params;

    const student = await Student.findById(studentId);
    const classData = await Class.findById(classId);

    if (!student) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    if (!classData) {
      return res.status(404).json({
        error: "Class not found",
      });
    }

    const alreadyEnrolled = classData.students.some(
      (id) => id.toString() === student._id.toString()
    );

    if (alreadyEnrolled) {
      return res.status(409).json({
        error: "Student is already enrolled in this class",
      });
    }

    const enrolled = await addStudentAtomically(classData._id, student._id);
    if (!enrolled) {
      return res.status(409).json({ error: "Student is already enrolled in this class" });
    }
    await syncStudentClassDetails([student._id], classData);
    await notifyStudentsOfEnrollment([student], classData);

    const updatedClass = await Class.findById(classId).populate("students");

    logAudit({
      req,
      action: "STUDENT_ENROLLED",
      category: "students",
      target: {
        entityType: "ClassRoster",
        entityId: String(classData._id),
        name: `${classData.name} · Section ${classData.section}`,
      },
      description: `Enrolled student '${student.name}' in class '${classData.name}'`,
      details: { studentId: student._id, studentName: student.name, classId: classData._id, className: classData.name },
    });

    res.json({
      message: "Student added to class successfully",
      class: updatedClass,
    });
  } catch (error) {
    console.error("Error adding student to class:", error.message);
    res.status(500).json({
      error: "Failed to add student to class",
    });
  }
});


// TEACHER: ADD STUDENT TO OWN CLASS
router.post(
  "/:studentId/classes/:classId/teacher/:userId",
  async (req, res) => {
    try {
      const { studentId, classId, userId } = req.params;

      const Teacher = require("../models/Teacher");

      const teacher = await Teacher.findOne({
        user: userId,
      });

      if (!teacher) {
        return res.status(404).json({
          error: "Teacher profile not found",
        });
      }

      const student = await Student.findById(studentId);

      if (!student) {
        return res.status(404).json({
          error: "Student not found",
        });
      }

      const classData = await Class.findById(classId);

      if (!classData) {
        return res.status(404).json({
          error: "Class not found",
        });
      }

      // Make sure this class belongs to the teacher
      if (
        classData.teacher.toString() !==
        teacher._id.toString()
      ) {
        return res.status(403).json({
          error: "You do not have permission to modify this class",
        });
      }

      // Prevent duplicate enrollment
      const alreadyEnrolled = classData.students.some(
        (id) => id.toString() === student._id.toString()
      );

      if (alreadyEnrolled) {
        return res.status(409).json({
          error: "Student is already enrolled in this class",
        });
      }

      const enrolled = await addStudentAtomically(classData._id, student._id);
      if (!enrolled) {
        return res.status(409).json({ error: "Student is already enrolled in this class" });
      }
      await syncStudentClassDetails([student._id], classData);
      await notifyStudentsOfEnrollment([student], classData);

      const updatedClass = await Class.findById(classId)
        .populate("teacher")
        .populate("students");

      res.json({
        message: "Student added to class successfully",
        class: updatedClass,
      });
    } catch (error) {
      console.error(
        "Teacher add student error:",
        error.message
      );

      res.status(500).json({
        error: "Failed to add student to class",
      });
    }
  }
);

router.delete("/:studentId/classes/:classId", requireAdmin, async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    if (!mongoose.isValidObjectId(studentId) || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: "Invalid student or class ID" });
    }
    const classData = await Class.findById(classId);
    if (!classData) return res.status(404).json({ error: "Class not found" });
    const removed = await Class.findOneAndUpdate(
      { _id: classData._id, students: studentId },
      { $pull: { students: studentId } },
      { new: true }
    ).select("_id").lean();
    if (!removed) {
      return res.status(404).json({ error: "Student is not enrolled in this class" });
    }

    logAudit({
      req,
      action: "STUDENT_REMOVED",
      category: "students",
      target: {
        entityType: "ClassRoster",
        entityId: String(classData._id),
        name: `${classData.name} · Section ${classData.section}`,
      },
      description: `Removed student from class '${classData.name}'`,
      details: { studentId, classId },
    });

    return res.json({ message: "Student removed from class", classId, studentId });
  } catch (error) {
    console.error("Remove student from class error:", error.message);
    return res.status(500).json({ error: "Failed to remove student from class" });
  }
});

module.exports = router;
