const {
  calculateClassGrades,
  isGradebookComplete,
  calculateAssignmentGrades,
  isAssignmentGradebookComplete,
} = require("../services/grades");
const Gradebook = require("../models/Gradebook");
const Class = require("../models/Class");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const AcademicPeriod = require("../models/AcademicPeriod");
const Notification = require("../models/Notification");
const SubjectAssignment = require("../models/SubjectAssignment");
const { logAudit } = require("../services/auditLogger");

/* ---------- helpers (used only by this controller) ---------- */

async function createNotifications(recipientIds, details) {
  const uniqueIds = [...new Set(recipientIds.filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return;

  try {
    await Notification.insertMany(uniqueIds.map((recipient) => ({ ...details, recipient })));
  } catch (error) {
    // Do not report a failed gradebook action after its state has already changed.
    console.error("Failed to create grade notifications:", error.message);
  }
}

// Admin, or the teacher who owns the assignment (assignment.teacher populated with "user").
function canViewAssignmentGradebook(user, assignment) {
  if (user.role === "admin") return true;
  return user.role === "teacher" && String(assignment.teacher?.user) === String(user._id);
}

// The same status payload was built in five places.
const gradebookStatus = (completeness, gradebook) => ({
  complete: completeness.complete,
  missingCategories: completeness.missingCategories,
  finalized: Boolean(gradebook),
  finalizedAt: gradebook?.finalizedAt || null,
});

/* ---------- subject (assignment) gradebooks ---------- */

// GET /assignment/:assignmentId/period/:periodId
async function getAssignmentGradebook(req, res) {
  try {
    const { assignmentId, periodId } = req.params;
    const assignment = await SubjectAssignment.findById(assignmentId)
      .populate("teacher", "user")
      .lean();
    if (!assignment) return res.status(404).json({ error: "Subject assignment not found" });
    if (!canViewAssignmentGradebook(req.authenticatedUser, assignment)) {
      return res
        .status(403)
        .json({ error: "You can only view gradebooks for your subject assignments" });
    }
    const [completeness, gradebook] = await Promise.all([
      isAssignmentGradebookComplete(assignmentId, periodId),
      Gradebook.findOne({ subjectAssignment: assignmentId, academicPeriod: periodId }).lean(),
    ]);
    const grades = completeness.complete
      ? await calculateAssignmentGrades(assignmentId, null, periodId)
      : [];
    return res.json({ grades, ...gradebookStatus(completeness, gradebook) });
  } catch (error) {
    console.error("Error fetching subject gradebook:", error.message);
    return res
      .status(error.message === "Subject assignment not found" ? 404 : 500)
      .json({ error: error.message || "Failed to fetch subject gradebook" });
  }
}

// GET /assignment/:assignmentId/period/:periodId/status
async function getAssignmentGradebookStatus(req, res) {
  try {
    const { assignmentId, periodId } = req.params;
    const assignment = await SubjectAssignment.findById(assignmentId)
      .populate("teacher", "user")
      .lean();
    if (!assignment) return res.status(404).json({ error: "Subject assignment not found" });
    if (!canViewAssignmentGradebook(req.authenticatedUser, assignment)) {
      return res
        .status(403)
        .json({ error: "You can only view gradebooks for your subject assignments" });
    }
    const [completeness, gradebook] = await Promise.all([
      isAssignmentGradebookComplete(assignmentId, periodId),
      Gradebook.findOne({ subjectAssignment: assignmentId, academicPeriod: periodId }).lean(),
    ]);
    return res.json(gradebookStatus(completeness, gradebook));
  } catch (error) {
    console.error("Error fetching subject gradebook status:", error.message);
    return res.status(500).json({ error: "Failed to fetch gradebook status" });
  }
}

// POST /assignment/:assignmentId/period/:periodId/finalize (IDs + role checked by middleware)
async function finalizeAssignmentGradebook(req, res) {
  try {
    const { assignmentId, periodId } = req.params;
    const assignment = await SubjectAssignment.findById(assignmentId)
      .populate("class")
      .populate("teacher", "user name")
      .lean();
    if (!assignment || !assignment.class) {
      return res.status(404).json({ error: "Subject assignment not found" });
    }
    const user = req.authenticatedUser;
    if (user.role === "teacher" && String(assignment.teacher?.user) !== String(user._id)) {
      return res
        .status(403)
        .json({ error: "You can only finalize your own subject assignments" });
    }
    const classGradebook = await Gradebook.findOne({
      class: assignment.class._id,
      academicPeriod: periodId,
      subjectAssignment: null,
    }).lean();
    if (classGradebook) {
      return res
        .status(409)
        .json({ error: "The class gradebook is already finalized for this academic period." });
    }
    const completeness = await isAssignmentGradebookComplete(assignmentId, periodId);
    if (!completeness.complete) {
      return res.status(422).json({
        error: `Cannot finalize: missing activities for ${completeness.missingCategories.join(", ")}`,
        missingCategories: completeness.missingCategories,
      });
    }
    const existing = await Gradebook.findOne({
      subjectAssignment: assignmentId,
      academicPeriod: periodId,
    });
    if (existing) {
      return res.status(409).json({
        error: "This subject gradebook has already been finalized",
        finalizedAt: existing.finalizedAt,
      });
    }

    const gradebook = await Gradebook.create({
      class: assignment.class._id,
      subjectAssignment: assignment._id,
      academicPeriod: periodId,
      finalizedAt: new Date(),
      finalizedBy: user._id,
    });
    try {
      const [students, period] = await Promise.all([
        Student.find({ _id: { $in: assignment.class.students || [] }, user: { $ne: null } })
          .select("user")
          .lean(),
        AcademicPeriod.findById(periodId).select("name").lean(),
      ]);
      await createNotifications(
        students.map((student) => student.user),
        {
          type: "grade_finalized",
          title: "Grades are ready",
          message: `Your ${assignment.subject} grade for ${assignment.class.name} (${assignment.class.section}) — ${period?.name || "this period"} is ready to view.`,
          link: "/student/grades",
        }
      );
      logAudit({
        req,
        action: "GRADEBOOK_FINALIZED",
        category: "grades",
        target: {
          entityType: "SubjectGradebook",
          entityId: String(gradebook._id),
          name: `${assignment.class.name} · ${assignment.subject} (${period?.name || "Term"})`,
        },
        description: `Finalized subject gradebook for ${assignment.class.name} (${assignment.class.section}) — ${assignment.subject} (${period?.name || "Term"})`,
        details: {
          classId: assignment.class._id,
          subjectAssignmentId: assignment._id,
          className: assignment.class.name,
          section: assignment.class.section,
          subject: assignment.subject,
          periodId,
          periodName: period?.name,
          finalizedAt: gradebook.finalizedAt,
        },
      });
    } catch (error) {
      console.error("Failed to prepare student subject-grade notifications:", error.message);
    }
    return res
      .status(201)
      .json({ message: "Subject gradebook finalized", finalizedAt: gradebook.finalizedAt });
  } catch (error) {
    console.error("Error finalizing subject gradebook:", error.message);
    if (error.code === 11000) {
      return res.status(409).json({ error: "This subject gradebook has already been finalized." });
    }
    return res.status(500).json({ error: "Failed to finalize subject gradebook" });
  }
}

// POST /assignment/:assignmentId/period/:periodId/unlock (admin role checked by middleware)
async function unlockAssignmentGradebook(req, res) {
  try {
    const { assignmentId, periodId } = req.params;
    const assignment = await SubjectAssignment.findById(assignmentId)
      .populate("class")
      .populate("teacher", "user")
      .lean();
    if (!assignment) return res.status(404).json({ error: "Subject assignment not found" });
    const deleted = await Gradebook.findOneAndDelete({
      subjectAssignment: assignmentId,
      academicPeriod: periodId,
    });
    if (!deleted) return res.status(404).json({ error: "Subject gradebook is not finalized" });
    try {
      const period = await AcademicPeriod.findById(periodId).select("name").lean();
      await createNotifications(assignment.teacher?.user ? [assignment.teacher.user] : [], {
        type: "grade_unlocked",
        title: `${assignment.subject} gradebook unlocked`,
        message: `The ${assignment.subject} gradebook for ${assignment.class.name} (${assignment.class.section}) — ${period?.name || "this period"} was unlocked by an administrator.`,
        link: `/teacher/scores?assignmentId=${assignmentId}&periodId=${periodId}`,
      });
      logAudit({
        req,
        action: "GRADEBOOK_UNLOCKED",
        category: "grades",
        target: {
          entityType: "SubjectGradebook",
          entityId: String(deleted._id),
          name: `${assignment.class.name} · ${assignment.subject} (${period?.name || "Term"})`,
        },
        description: `Unlocked subject gradebook for ${assignment.class.name} (${assignment.class.section}) — ${assignment.subject} (${period?.name || "Term"})`,
        details: {
          classId: assignment.class._id,
          subjectAssignmentId: assignment._id,
          className: assignment.class.name,
          section: assignment.class.section,
          subject: assignment.subject,
          periodId,
          periodName: period?.name,
        },
      });
    } catch (error) {
      console.error("Failed to prepare subject unlock notification:", error.message);
    }
    return res.json({ message: "Subject gradebook unlocked", finalized: false });
  } catch (error) {
    console.error("Error unlocking subject gradebook:", error.message);
    return res.status(500).json({ error: "Failed to unlock subject gradebook" });
  }
}

/* ---------- class gradebooks ---------- */

// GET /class/:classId - all students, no period filter
async function getClassGrades(req, res) {
  try {
    const results = await calculateClassGrades(req.params.classId);
    return res.json(results);
  } catch (error) {
    console.error("Error calculating class grades:", error.message);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: "Class not found" });
    }
    return res.status(500).json({ error: "Failed to calculate class grades" });
  }
}

// GET /class/:classId/student/:studentId
async function getStudentClassGrade(req, res) {
  try {
    const [result] = await calculateClassGrades(req.params.classId, req.params.studentId);
    if (!result) {
      return res.status(404).json({ error: "Student grade not found" });
    }
    return res.json(result);
  } catch (error) {
    console.error("Error calculating student grade:", error.message);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: "Class not found" });
    }
    return res.status(500).json({ error: "Failed to calculate student grade" });
  }
}

// GET /class/:classId/period/:periodId - teacher preview; finalization is reported, not a gate
async function getClassPeriodGrades(req, res) {
  try {
    const { classId, periodId } = req.params;

    const [completeness, gradebook] = await Promise.all([
      isGradebookComplete(classId, periodId),
      Gradebook.findOne({ class: classId, academicPeriod: periodId, subjectAssignment: null }).lean(),
    ]);

    if (!completeness.complete) {
      return res.json({ grades: [], ...gradebookStatus(completeness, gradebook) });
    }

    const grades = await calculateClassGrades(classId, null, periodId);

    return res.json({
      grades,
      ...gradebookStatus(completeness, gradebook),
      complete: true,
      missingCategories: [],
    });
  } catch (error) {
    console.error("Error fetching period grades:", error.message);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: "Class not found" });
    }
    return res.status(500).json({ error: "Failed to fetch period grades" });
  }
}

// GET /class/:classId/period/:periodId/status
async function getClassPeriodStatus(req, res) {
  try {
    const { classId, periodId } = req.params;

    const [completeness, gradebook] = await Promise.all([
      isGradebookComplete(classId, periodId),
      Gradebook.findOne({ class: classId, academicPeriod: periodId, subjectAssignment: null }).lean(),
    ]);

    return res.json(gradebookStatus(completeness, gradebook));
  } catch (error) {
    console.error("Error fetching gradebook status:", error.message);
    return res.status(500).json({ error: "Failed to fetch gradebook status" });
  }
}

// POST /class/:classId/period/:periodId/finalize (role + IDs checked by middleware)
async function finalizeClassGradebook(req, res) {
  try {
    const { classId, periodId } = req.params;
    const user = req.authenticatedUser;

    const classRecord = await Class.findById(classId).lean();
    if (!classRecord) {
      return res.status(404).json({ error: "Class not found" });
    }

    if (user.role === "teacher") {
      const teacher = await Teacher.findById(classRecord.teacher).select("user").lean();
      if (!teacher || String(teacher.user) !== String(user._id)) {
        return res
          .status(403)
          .json({ error: "You can only finalize grades for your own classes" });
      }
    }

    // Completeness gate
    const completeness = await isGradebookComplete(classId, periodId);
    if (!completeness.complete) {
      const labels = {
        written_work: "Written Work",
        performance_task: "Performance Task",
        assessment: "Assessment",
      };
      const missing = completeness.missingCategories.map((k) => labels[k] || k).join(", ");

      return res.status(422).json({
        error: `Cannot finalize: the following categories have no activities — ${missing}`,
        missingCategories: completeness.missingCategories,
      });
    }

    // Already finalized?
    const existing = await Gradebook.findOne({
      class: classId,
      academicPeriod: periodId,
      subjectAssignment: null,
    });

    if (existing) {
      return res.status(409).json({
        error: "This gradebook has already been finalized",
        finalizedAt: existing.finalizedAt,
      });
    }

    const gradebook = await Gradebook.create({
      class: classId,
      academicPeriod: periodId,
      finalizedAt: new Date(),
      finalizedBy: user._id,
    });

    try {
      const [studentProfiles, period] = await Promise.all([
        Student.find({ _id: { $in: classRecord.students || [] }, user: { $ne: null } })
          .select("user")
          .lean(),
        AcademicPeriod.findById(periodId).select("name").lean(),
      ]);
      const periodName = period?.name || "the academic period";
      await createNotifications(
        studentProfiles.map((student) => student.user),
        {
          type: "grade_finalized",
          title: "Grades are ready",
          message: `Your finalized grade for ${classRecord.name} (${classRecord.section}) — ${periodName} is ready to view.`,
          link: "/student/grades",
        }
      );
      logAudit({
        req,
        action: "CLASS_GRADEBOOK_FINALIZED",
        category: "grades",
        target: {
          entityType: "ClassGradebook",
          entityId: String(gradebook._id),
          name: `${classRecord.name} · Section ${classRecord.section} (${periodName})`,
        },
        description: `Finalized class gradebook for ${classRecord.name} (${classRecord.section}) — ${periodName}`,
        details: {
          classId: classRecord._id,
          className: classRecord.name,
          section: classRecord.section,
          periodId,
          periodName,
          finalizedAt: gradebook.finalizedAt,
        },
      });
    } catch (notificationError) {
      console.error("Failed to prepare student grade notifications:", notificationError.message);
    }

    return res.status(201).json({
      message: "Gradebook finalized successfully",
      finalizedAt: gradebook.finalizedAt,
    });
  } catch (error) {
    console.error("Error finalizing gradebook:", error.message);
    if (error.code === 11000) {
      return res.status(409).json({ error: "This gradebook has already been finalized." });
    }
    return res.status(500).json({ error: "Failed to finalize gradebook" });
  }
}

// POST /class/:classId/period/:periodId/unlock (admin role + IDs checked by middleware)
async function unlockClassGradebook(req, res) {
  try {
    const { classId, periodId } = req.params;

    const existing = await Gradebook.findOne({
      class: classId,
      academicPeriod: periodId,
      subjectAssignment: null,
    });

    if (!existing) {
      return res.status(404).json({ error: "Gradebook is not currently finalized" });
    }

    const classRecord = await Class.findById(classId).lean();
    if (!classRecord) {
      return res.status(404).json({ error: "Class not found" });
    }

    await Gradebook.deleteOne({
      class: classId,
      academicPeriod: periodId,
      subjectAssignment: null,
    });

    try {
      const [teacher, period] = await Promise.all([
        Teacher.findById(classRecord.teacher).select("user").lean(),
        AcademicPeriod.findById(periodId).select("name").lean(),
      ]);
      const periodName = period?.name || "the academic period";
      await createNotifications(teacher?.user ? [teacher.user] : [], {
        type: "grade_unlocked",
        title: "Gradebook unlocked",
        message: `The finalized grades for ${classRecord.name} (${classRecord.section}) — ${periodName} were unlocked by an administrator. You can now make updates.`,
        link: `/teacher/scores?classId=${classId}&periodId=${periodId}`,
      });
      logAudit({
        req,
        action: "CLASS_GRADEBOOK_UNLOCKED",
        category: "grades",
        target: {
          entityType: "ClassGradebook",
          entityId: String(existing._id),
          name: `${classRecord.name} · Section ${classRecord.section} (${periodName})`,
        },
        description: `Unlocked class gradebook for ${classRecord.name} (${classRecord.section}) — ${periodName}`,
        details: {
          classId: classRecord._id,
          className: classRecord.name,
          section: classRecord.section,
          periodId,
          periodName,
        },
      });
    } catch (notificationError) {
      console.error("Failed to prepare teacher grade notification:", notificationError.message);
    }

    return res.json({ message: "Gradebook unlocked successfully", finalized: false });
  } catch (error) {
    console.error("Error unlocking gradebook:", error.message);
    return res.status(500).json({ error: "Failed to unlock gradebook" });
  }
}

module.exports = {
  getAssignmentGradebook,
  getAssignmentGradebookStatus,
  finalizeAssignmentGradebook,
  unlockAssignmentGradebook,
  getClassGrades,
  getStudentClassGrade,
  getClassPeriodGrades,
  getClassPeriodStatus,
  finalizeClassGradebook,
  unlockClassGradebook,
};