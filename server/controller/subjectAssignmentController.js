const SubjectAssignment = require("../models/SubjectAssignment");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const { logAudit } = require("../services/auditLogger");
const {
  notifyTeacherOfAssignment,
  notifyStudentsOfSubject,
} = require("../services/assignmentNotifications");

/* ---------- helpers (used only by this controller) ---------- */

function populateAssignment(query) {
  return query
    .populate({ path: "class", populate: { path: "students" } })
    .populate("teacher", "name email user")
    .sort({ createdAt: -1 });
}

/* ---------- handlers ---------- */

// GET / (admin)
async function getAssignments(req, res) {
  try {
    const assignments = await populateAssignment(SubjectAssignment.find({ active: true }));
    return res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch subject assignments:", error.message);
    return res.status(500).json({ error: "Failed to fetch subject assignments" });
  }
}

// GET /teacher/:userId (self-or-admin checked by middleware)
async function getTeacherAssignments(req, res) {
  try {
    const teacher = await Teacher.findOne({ user: req.params.userId }).select("_id");
    if (!teacher) return res.json([]);
    const assignments = await populateAssignment(
      SubjectAssignment.find({ teacher: teacher._id, active: true })
    );
    return res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch teacher subject assignments:", error.message);
    return res.status(500).json({ error: "Failed to fetch teacher assignments" });
  }
}

// GET /class/:classId (admin)
async function getClassAssignments(req, res) {
  try {
    const assignments = await populateAssignment(
      SubjectAssignment.find({ class: req.params.classId, active: true })
    );
    return res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch class subject assignments:", error.message);
    return res.status(500).json({ error: "Failed to fetch class assignments" });
  }
}

// POST / (admin; body validated by middleware)
async function createAssignment(req, res) {
  try {
    const { classId, subject, teacherUserId, gradingSystem } = req.assignmentData;

    const [classRecord, teacher] = await Promise.all([
      Class.findById(classId),
      Teacher.findOne({ user: teacherUserId }),
    ]);
    if (!classRecord) return res.status(404).json({ error: "Class not found" });
    if (!teacher) return res.status(404).json({ error: "Teacher profile not found" });

    const assignment = await SubjectAssignment.create({
      class: classRecord._id,
      subject,
      teacher: teacher._id,
      gradingSystem,
    });
    const populated = await populateAssignment(SubjectAssignment.findById(assignment._id));

    await notifyTeacherOfAssignment({
      teacher,
      classRecord,
      subject: assignment.subject,
      assignmentId: assignment._id,
    });
    await notifyStudentsOfSubject({ classRecord, subject: assignment.subject });
    await notifyStudentsOfSubject({
      classRecord,
      subject: assignment.subject,
      teacherName: teacher.name,
      teacherChanged: true,
    });

    logAudit({
      req,
      action: "SUBJECT_ASSIGNED",
      category: "classes",
      target: {
        entityType: "SubjectAssignment",
        entityId: String(assignment._id),
        name: `${classRecord.name} · ${subject}`,
      },
      description: `Assigned subject '${subject}' to class '${classRecord.name}' for teacher '${teacher.name}'`,
      details: {
        classId: classRecord._id,
        className: classRecord.name,
        subject,
        teacherName: teacher.name,
      },
    });

    return res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "This subject is already assigned to the class" });
    }
    console.error("Failed to create subject assignment:", error.message);
    return res.status(500).json({ error: "Failed to create subject assignment" });
  }
}

// PATCH /:id (admin; ID and body validated by middleware)
async function updateAssignment(req, res) {
  try {
    const updates = req.assignmentUpdates;

    const assignment = await SubjectAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Subject assignment not found" });

    let assignedTeacher = null;
    const teacherChanged = "teacherUserId" in updates;
    const previousTeacherId = String(assignment.teacher);

    if (updates.subject !== undefined) assignment.subject = updates.subject;
    if (teacherChanged) {
      assignedTeacher = await Teacher.findOne({ user: updates.teacherUserId });
      if (!assignedTeacher) return res.status(404).json({ error: "Teacher profile not found" });
      assignment.teacher = assignedTeacher._id;
    }
    if (updates.gradingSystem !== undefined) assignment.gradingSystem = updates.gradingSystem;
    if (updates.active !== undefined) assignment.active = updates.active;

    await assignment.save();
    const populated = await populateAssignment(SubjectAssignment.findById(assignment._id));

    if (teacherChanged && String(assignment.teacher) !== previousTeacherId && assignment.active) {
      const classRecord = await Class.findById(assignment.class);
      if (classRecord) {
        await notifyTeacherOfAssignment({
          teacher: assignedTeacher,
          classRecord,
          subject: assignment.subject,
          assignmentId: assignment._id,
        });
        await notifyStudentsOfSubject({
          classRecord,
          subject: assignment.subject,
          teacherName: assignedTeacher.name,
          teacherChanged: true,
        });
      }
    }

    logAudit({
      req,
      action: "SUBJECT_ASSIGNMENT_UPDATED",
      category: "classes",
      target: {
        entityType: "SubjectAssignment",
        entityId: String(assignment._id),
        name: `${assignment.subject}`,
      },
      description: `Updated subject assignment '${assignment.subject}'`,
      details: {
        assignmentId: assignment._id,
        subject: assignment.subject,
        active: assignment.active,
      },
    });

    return res.json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "This subject is already assigned to the class" });
    }
    console.error("Failed to update subject assignment:", error.message);
    return res.status(500).json({ error: "Failed to update subject assignment" });
  }
}

// DELETE /:id (admin; ID validated by middleware)
async function deleteAssignment(req, res) {
  try {
    const assignment = await SubjectAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: "Subject assignment not found" });
    }
    await SubjectAssignment.findByIdAndDelete(req.params.id);

    logAudit({
      req,
      action: "SUBJECT_ASSIGNMENT_DELETED",
      category: "classes",
      target: {
        entityType: "SubjectAssignment",
        entityId: String(assignment._id),
        name: assignment.subject,
      },
      description: `Removed subject assignment '${assignment.subject}'`,
      details: { assignmentId: assignment._id, subject: assignment.subject },
    });

    return res.json({ message: "Subject assignment removed successfully" });
  } catch (error) {
    console.error("Failed to delete subject assignment:", error.message);
    return res.status(500).json({ error: "Failed to delete subject assignment" });
  }
}

module.exports = {
  getAssignments,
  getTeacherAssignments,
  getClassAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};