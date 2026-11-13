const express = require("express");
const mongoose = require("mongoose");

const SubjectAssignment = require("../models/SubjectAssignment");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const Notification = require("../models/Notification");
const Student = require("../models/Student");
const { requireAdmin, requireAuthenticatedUser } = require("../middleware/authorization");
const { logAudit } = require("../services/auditLogger");

const router = express.Router();

function normalizeGradingSystem(input) {
  if (!input?.enabled) return { enabled: false, components: [] };
  const components = Array.isArray(input.components) ? input.components : [];
  const total = components.reduce((sum, component) => sum + Number(component.percentage || 0), 0);
  if (components.length !== 3 || total !== 100) return null;
  return { enabled: true, components };
}

function populateAssignment(query) {
  return query
    .populate({ path: "class", populate: { path: "students" } })
    .populate("teacher", "name email user")
    .sort({ createdAt: -1 });
}

async function notifyTeacherOfAssignment({ teacher, classRecord, subject, assignmentId }) {
  if (!teacher?.user) return;
  try {
    await Notification.create({
      recipient: teacher.user,
      type: "subject_assigned",
      title: "New subject assignment",
      message: `You have been assigned to teach ${subject} for ${classRecord.name} · Section ${classRecord.section} (Grade ${classRecord.gradeLevel}).`,
      link: `/teacher/classes/${classRecord._id}`,
    });
  } catch (error) {
    // Assignment changes should succeed even if notification delivery fails.
    console.error(`Failed to notify teacher about assignment ${assignmentId}:`, error.message);
  }
}

async function notifyStudentsOfSubject({ classRecord, subject, teacherName, teacherChanged = false }) {
  try {
    const students = await Student.find({ _id: { $in: classRecord.students || [] }, user: { $ne: null } })
      .select("user")
      .lean();
    if (!students.length) return;
    const notification = teacherChanged
      ? {
          type: "student_teacher_assigned",
          title: "Teacher assigned to your subject",
          message: `${teacherName} has been assigned to teach ${subject} in ${classRecord.name} · Section ${classRecord.section}.`,
        }
      : {
          type: "student_subject_added",
          title: "New subject added to your class",
          message: `${subject} has been added to ${classRecord.name} · Section ${classRecord.section}.`,
        };
    await Notification.insertMany(students.map(({ user }) => ({
      ...notification,
      recipient: user,
      link: "/student/grades",
    })));
  } catch (error) {
    console.error("Failed to notify students about subject assignment:", error.message);
  }
}

router.get("/", requireAdmin, async (req, res) => {
  try {
    const assignments = await populateAssignment(SubjectAssignment.find({ active: true }));
    return res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch subject assignments:", error.message);
    return res.status(500).json({ error: "Failed to fetch subject assignments" });
  }
});

router.get("/teacher/:userId", requireAuthenticatedUser, async (req, res) => {
  try {
    if (req.authenticatedUser.role !== "admin" && String(req.authenticatedUser._id) !== String(req.params.userId)) {
      return res.status(403).json({ error: "You can only view your own subject assignments" });
    }
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
});

router.get("/class/:classId", requireAdmin, async (req, res) => {
  try {
    const assignments = await populateAssignment(
      SubjectAssignment.find({ class: req.params.classId, active: true })
    );
    return res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch class subject assignments:", error.message);
    return res.status(500).json({ error: "Failed to fetch class assignments" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { classId, subject, teacherUserId, gradingSystem } = req.body || {};
    if (!mongoose.isValidObjectId(classId) || !mongoose.isValidObjectId(teacherUserId) || !subject?.trim()) {
      return res.status(400).json({ error: "Class, subject, and teacher are required" });
    }

    const [classRecord, teacher] = await Promise.all([
      Class.findById(classId),
      Teacher.findOne({ user: teacherUserId }),
    ]);
    if (!classRecord) return res.status(404).json({ error: "Class not found" });
    if (!teacher) return res.status(404).json({ error: "Teacher profile not found" });

    const normalizedGradingSystem = normalizeGradingSystem(gradingSystem);
    if (!normalizedGradingSystem) {
      return res.status(400).json({ error: "Subject grading percentages must total 100%" });
    }

    const assignment = await SubjectAssignment.create({
      class: classRecord._id,
      subject: subject.trim(),
      teacher: teacher._id,
      gradingSystem: normalizedGradingSystem,
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
        name: `${classRecord.name} · ${subject.trim()}`,
      },
      description: `Assigned subject '${subject.trim()}' to class '${classRecord.name}' for teacher '${teacher.name}'`,
      details: { classId: classRecord._id, className: classRecord.name, subject: subject.trim(), teacherName: teacher.name },
    });

    return res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "This subject is already assigned to the class" });
    }
    console.error("Failed to create subject assignment:", error.message);
    return res.status(500).json({ error: "Failed to create subject assignment" });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid subject assignment ID" });
    }
    const assignment = await SubjectAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Subject assignment not found" });

    const { subject, teacherUserId, gradingSystem, active } = req.body || {};
    let assignedTeacher = null;
    const teacherChanged = teacherUserId !== undefined;
    const previousTeacherId = String(assignment.teacher);
    if (subject !== undefined) {
      if (!subject.trim()) return res.status(400).json({ error: "Subject is required" });
      assignment.subject = subject.trim();
    }
    if (teacherUserId !== undefined) {
      assignedTeacher = await Teacher.findOne({ user: teacherUserId });
      if (!assignedTeacher) return res.status(404).json({ error: "Teacher profile not found" });
      assignment.teacher = assignedTeacher._id;
    }
    if (gradingSystem !== undefined) {
      const normalized = normalizeGradingSystem(gradingSystem);
      if (!normalized) return res.status(400).json({ error: "Subject grading percentages must total 100%" });
      assignment.gradingSystem = normalized;
    }
    if (active !== undefined) assignment.active = Boolean(active);
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
      details: { assignmentId: assignment._id, subject: assignment.subject, active: assignment.active },
    });

    return res.json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "This subject is already assigned to the class" });
    }
    console.error("Failed to update subject assignment:", error.message);
    return res.status(500).json({ error: "Failed to update subject assignment" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid subject assignment ID" });
    }
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
});

module.exports = router;
