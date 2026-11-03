const express = require("express");
const mongoose = require("mongoose");

const {
  calculateClassGrades,
  isGradebookComplete,
  calculateAssignmentGrades,
  isAssignmentGradebookComplete,
  calculateStudentGradeFromActivities,
} = require("../services/grades");
const Gradebook = require("../models/Gradebook");
const Class = require("../models/Class");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const AcademicPeriod = require("../models/AcademicPeriod");
const Notification = require("../models/Notification");
const SubjectAssignment = require("../models/SubjectAssignment");
const Activity = require("../models/Activity");
const Score = require("../models/Score");
const {
  getTokenUserId,
  requireAuthenticatedUser,
} = require("../middleware/authorization");
const { logAudit } = require("../services/auditLogger");

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: resolve the User._id from the Authorization header (best-effort).
// If the token is missing/invalid we still allow the action; it just means
// finalizedBy won't be set. Callers that need strict auth should add their
// own middleware first.
// ---------------------------------------------------------------------------
function resolveUserId(req) {
  const auth = req.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return getTokenUserId(match[1]);
}

async function createNotifications(recipientIds, details) {
  const uniqueIds = [...new Set(recipientIds.filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return;

  try {
    await Notification.insertMany(
      uniqueIds.map((recipient) => ({ ...details, recipient }))
    );
  } catch (error) {
    // Do not report a failed gradebook action after its state has already changed.
    console.error("Failed to create grade notifications:", error.message);
  }
}

router.get("/assignment/:assignmentId/period/:periodId", requireAuthenticatedUser, async (req, res) => {
  try {
    const { assignmentId, periodId } = req.params;
    const assignment = await SubjectAssignment.findById(assignmentId).populate("teacher", "user").lean();
    if (!assignment) return res.status(404).json({ error: "Subject assignment not found" });
    if (req.authenticatedUser.role !== "admin" && (req.authenticatedUser.role !== "teacher" || String(assignment.teacher?.user) !== String(req.authenticatedUser._id))) {
      return res.status(403).json({ error: "You can only view gradebooks for your subject assignments" });
    }
    const [completeness, gradebook] = await Promise.all([
      isAssignmentGradebookComplete(assignmentId, periodId),
      Gradebook.findOne({ subjectAssignment: assignmentId, academicPeriod: periodId }).lean(),
    ]);
    const grades = completeness.complete
      ? await calculateAssignmentGrades(assignmentId, null, periodId)
      : [];
    return res.json({
      grades,
      complete: completeness.complete,
      missingCategories: completeness.missingCategories,
      finalized: Boolean(gradebook),
      finalizedAt: gradebook?.finalizedAt || null,
    });
  } catch (error) {
    console.error("Error fetching subject gradebook:", error.message);
    return res.status(error.message === "Subject assignment not found" ? 404 : 500)
      .json({ error: error.message || "Failed to fetch subject gradebook" });
  }
});

router.get("/assignment/:assignmentId/period/:periodId/status", requireAuthenticatedUser, async (req, res) => {
  try {
    const { assignmentId, periodId } = req.params;
    const assignment = await SubjectAssignment.findById(assignmentId).populate("teacher", "user").lean();
    if (!assignment) return res.status(404).json({ error: "Subject assignment not found" });
    if (req.authenticatedUser.role !== "admin" && (req.authenticatedUser.role !== "teacher" || String(assignment.teacher?.user) !== String(req.authenticatedUser._id))) {
      return res.status(403).json({ error: "You can only view gradebooks for your subject assignments" });
    }
    const [completeness, gradebook] = await Promise.all([
      isAssignmentGradebookComplete(assignmentId, periodId),
      Gradebook.findOne({ subjectAssignment: assignmentId, academicPeriod: periodId }).lean(),
    ]);
    return res.json({
      complete: completeness.complete,
      missingCategories: completeness.missingCategories,
      finalized: Boolean(gradebook),
      finalizedAt: gradebook?.finalizedAt || null,
    });
  } catch (error) {
    console.error("Error fetching subject gradebook status:", error.message);
    return res.status(500).json({ error: "Failed to fetch gradebook status" });
  }
});

router.post("/assignment/:assignmentId/period/:periodId/finalize", requireAuthenticatedUser, async (req, res) => {
  try {
    const { assignmentId, periodId } = req.params;
    if (!mongoose.isValidObjectId(assignmentId) || !mongoose.isValidObjectId(periodId)) {
      return res.status(400).json({ error: "Invalid subject assignment or period ID" });
    }
    const assignment = await SubjectAssignment.findById(assignmentId)
      .populate("class")
      .populate("teacher", "user name")
      .lean();
    if (!assignment || !assignment.class) return res.status(404).json({ error: "Subject assignment not found" });
    const user = req.authenticatedUser;
    if (!["admin", "teacher"].includes(user.role)) {
      return res.status(403).json({ error: "Teacher or administrator access is required" });
    }
    if (user.role === "teacher" && String(assignment.teacher?.user) !== String(user._id)) {
      return res.status(403).json({ error: "You can only finalize your own subject assignments" });
    }
    const completeness = await isAssignmentGradebookComplete(assignmentId, periodId);
    if (!completeness.complete) {
      return res.status(422).json({
        error: `Cannot finalize: missing activities for ${completeness.missingCategories.join(", ")}`,
        missingCategories: completeness.missingCategories,
      });
    }
    const existing = await Gradebook.findOne({ subjectAssignment: assignmentId, academicPeriod: periodId });
    if (existing) return res.status(409).json({ error: "This subject gradebook has already been finalized", finalizedAt: existing.finalizedAt });

    const gradebook = await Gradebook.create({
      class: assignment.class._id,
      subjectAssignment: assignment._id,
      academicPeriod: periodId,
      finalizedAt: new Date(),
      finalizedBy: user._id,
    });
    try {
      const [students, period] = await Promise.all([
        Student.find({ _id: { $in: assignment.class.students || [] }, user: { $ne: null } }).select("user").lean(),
        AcademicPeriod.findById(periodId).select("name").lean(),
      ]);
      await createNotifications(students.map((student) => student.user), {
        type: "grade_finalized",
        title: "Grades are ready",
        message: `Your ${assignment.subject} grade for ${assignment.class.name} (${assignment.class.section}) — ${period?.name || "this period"} is ready to view.`,
        link: "/student/grades",
      });
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
    return res.status(201).json({ message: "Subject gradebook finalized", finalizedAt: gradebook.finalizedAt });
  } catch (error) {
    console.error("Error finalizing subject gradebook:", error.message);
    return res.status(500).json({ error: "Failed to finalize subject gradebook" });
  }
});

router.post("/assignment/:assignmentId/period/:periodId/unlock", requireAuthenticatedUser, async (req, res) => {
  try {
    if (req.authenticatedUser.role !== "admin") {
      return res.status(403).json({ error: "Administrator access is required" });
    }
    const { assignmentId, periodId } = req.params;
    const assignment = await SubjectAssignment.findById(assignmentId)
      .populate("class")
      .populate("teacher", "user")
      .lean();
    if (!assignment) return res.status(404).json({ error: "Subject assignment not found" });
    const deleted = await Gradebook.findOneAndDelete({ subjectAssignment: assignmentId, academicPeriod: periodId });
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
});

// ---------------------------------------------------------------------------
// GET /api/grades/class/:classId
// Original endpoint – all students, no period filter
// ---------------------------------------------------------------------------
router.get("/class/:classId", async (req, res) => {
  try {
    const results = await calculateClassGrades(req.params.classId);

    return res.json(results);
  } catch (error) {
    console.error("Error calculating class grades:", error.message);

    if (error.message === "Class not found") {
      return res.status(404).json({
        error: "Class not found",
      });
    }

    return res.status(500).json({
      error: "Failed to calculate class grades",
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/grades/class/:classId/student/:studentId
// ---------------------------------------------------------------------------
router.get("/class/:classId/student/:studentId", async (req, res) => {
  try {
    const [result] = await calculateClassGrades(
      req.params.classId,
      req.params.studentId
    );

    if (!result) {
      return res.status(404).json({
        error: "Student grade not found",
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Error calculating student grade:", error.message);

    if (error.message === "Class not found") {
      return res.status(404).json({
        error: "Class not found",
      });
    }

    return res.status(500).json({
      error: "Failed to calculate student grade",
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/grades/class/:classId/period/:periodId
// All students' grades scoped to one academic period (teacher preview).
// Always returns data; finalization status is included but not a gate here.
// ---------------------------------------------------------------------------
router.get("/class/:classId/period/:periodId", async (req, res) => {
  try {
    const { classId, periodId } = req.params;

    const [completeness, gradebook] = await Promise.all([
      isGradebookComplete(classId, periodId),
      Gradebook.findOne({ class: classId, academicPeriod: periodId }).lean(),
    ]);

    if (!completeness.complete) {
      return res.json({
        grades: [],
        complete: false,
        missingCategories: completeness.missingCategories,
        finalized: !!gradebook,
        finalizedAt: gradebook?.finalizedAt || null,
      });
    }

    const grades = await calculateClassGrades(classId, null, periodId);

    return res.json({
      grades,
      complete: true,
      missingCategories: [],
      finalized: !!gradebook,
      finalizedAt: gradebook?.finalizedAt || null,
    });
  } catch (error) {
    console.error("Error fetching period grades:", error.message);

    if (error.message === "Class not found") {
      return res.status(404).json({ error: "Class not found" });
    }

    return res.status(500).json({ error: "Failed to fetch period grades" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/grades/class/:classId/period/:periodId/status
// Lightweight check – is the gradebook finalized? Is it complete?
// ---------------------------------------------------------------------------
router.get("/class/:classId/period/:periodId/status", async (req, res) => {
  try {
    const { classId, periodId } = req.params;

    const [completeness, gradebook] = await Promise.all([
      isGradebookComplete(classId, periodId),
      Gradebook.findOne({ class: classId, academicPeriod: periodId }).lean(),
    ]);

    return res.json({
      complete: completeness.complete,
      missingCategories: completeness.missingCategories,
      finalized: !!gradebook,
      finalizedAt: gradebook?.finalizedAt || null,
    });
  } catch (error) {
    console.error("Error fetching gradebook status:", error.message);
    return res.status(500).json({ error: "Failed to fetch gradebook status" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/grades/class/:classId/period/:periodId/finalize
// Teacher finalizes the gradebook for this class + period.
// Blocked if the gradebook is incomplete (any category missing activities).
// ---------------------------------------------------------------------------
router.post("/class/:classId/period/:periodId/finalize", requireAuthenticatedUser, async (req, res) => {
  try {
    const { classId, periodId } = req.params;
    const user = req.authenticatedUser;

    if (!["admin", "teacher"].includes(user.role)) {
      return res.status(403).json({ error: "Teacher or administrator access is required" });
    }

    // Validate IDs
    if (
      !mongoose.isValidObjectId(classId) ||
      !mongoose.isValidObjectId(periodId)
    ) {
      return res.status(400).json({ error: "Invalid class or period ID" });
    }

    // Verify class exists
    const classRecord = await Class.findById(classId).lean();
    if (!classRecord) {
      return res.status(404).json({ error: "Class not found" });
    }

    if (user.role === "teacher") {
      const teacher = await Teacher.findById(classRecord.teacher).select("user").lean();
      if (!teacher || String(teacher.user) !== String(user._id)) {
        return res.status(403).json({ error: "You can only finalize grades for your own classes" });
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
      const missing = completeness.missingCategories
        .map((k) => labels[k] || k)
        .join(", ");

      return res.status(422).json({
        error: `Cannot finalize: the following categories have no activities — ${missing}`,
        missingCategories: completeness.missingCategories,
      });
    }

    // Already finalized?
    const existing = await Gradebook.findOne({
      class: classId,
      academicPeriod: periodId,
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
    return res.status(500).json({ error: "Failed to finalize gradebook" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/grades/class/:classId/period/:periodId/unlock
// Admin unlocks the finalized gradebook for this class + period.
// ---------------------------------------------------------------------------
router.post("/class/:classId/period/:periodId/unlock", requireAuthenticatedUser, async (req, res) => {
  try {
    const { classId, periodId } = req.params;

    if (req.authenticatedUser.role !== "admin") {
      return res.status(403).json({ error: "Administrator access is required" });
    }

    if (
      !mongoose.isValidObjectId(classId) ||
      !mongoose.isValidObjectId(periodId)
    ) {
      return res.status(400).json({ error: "Invalid class or period ID" });
    }

    const existing = await Gradebook.findOne({
      class: classId,
      academicPeriod: periodId,
    });

    if (!existing) {
      return res.status(404).json({
        error: "Gradebook is not currently finalized",
      });
    }

    const classRecord = await Class.findById(classId).lean();
    if (!classRecord) {
      return res.status(404).json({ error: "Class not found" });
    }

    await Gradebook.deleteOne({
      class: classId,
      academicPeriod: periodId,
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

    return res.json({
      message: "Gradebook unlocked successfully",
      finalized: false,
    });
  } catch (error) {
    console.error("Error unlocking gradebook:", error.message);
    return res.status(500).json({ error: "Failed to unlock gradebook" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/grades/student/me/class/:classId/period/:periodId
// Returns a student's own grade for the given class + period.
// Only resolves data if the gradebook is finalized AND complete.
// ---------------------------------------------------------------------------
router.get(
  "/student/me/class/:classId/period/:periodId",
  async (req, res) => {
    try {
      const { classId, periodId } = req.params;
      const userId = resolveUserId(req);

      if (!userId) {
        return res.status(401).json({ error: "A valid login is required" });
      }

      // Look up the Student profile for this user
      const student = await Student.findOne({ user: userId }).lean();
      if (!student) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      // Gradebook must be finalized
      const gradebook = await Gradebook.findOne({
        class: classId,
        academicPeriod: periodId,
      }).lean();

      if (!gradebook) {
        return res.json({
          available: false,
          reason: "not_finalized",
        });
      }

      // Completeness check (defensive – should always pass if finalized)
      const completeness = await isGradebookComplete(classId, periodId);
      if (!completeness.complete) {
        return res.json({
          available: false,
          reason: "incomplete",
          missingCategories: completeness.missingCategories,
        });
      }

      // Calculate grade
      const [gradeSummary] = await calculateClassGrades(
        classId,
        String(student._id),
        periodId
      );

      if (!gradeSummary) {
        return res.status(404).json({ error: "Grade not found" });
      }

      return res.json({
        available: true,
        studentId: String(student._id),
        finalizedAt: gradebook.finalizedAt,
        ...gradeSummary,
      });
    } catch (error) {
      console.error("Error fetching student grade:", error.message);
      return res
        .status(500)
        .json({ error: "Failed to fetch student grade" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/grades/student/me/dashboard
// Student-safe dashboard data: own coursework progress and published updates.
// ---------------------------------------------------------------------------
router.get("/student/me/dashboard", requireAuthenticatedUser, async (req, res) => {
  try {
    if (req.authenticatedUser.role !== "student") {
      return res.status(403).json({ error: "Student access is required" });
    }

    const student = await Student.findOne({ user: req.authenticatedUser._id }).lean();
    if (!student) return res.status(404).json({ error: "Student profile not found" });

    const classes = await Class.find({ students: student._id }).lean();
    if (!classes.length) {
      return res.json({ subjects: [], recentUpdates: [], currentAverage: null, recentUpdatesCount: 0 });
    }

    const assignments = await SubjectAssignment.find({
      class: { $in: classes.map((classRecord) => classRecord._id) },
      active: true,
    })
      .populate("class")
      .populate("teacher", "name")
      .lean();

    if (!assignments.length) {
      return res.json({ subjects: [], recentUpdates: [], currentAverage: null, recentUpdatesCount: 0 });
    }

    const assignmentIds = assignments.map((assignment) => assignment._id);
    const activities = await Activity.find({ subjectAssignment: { $in: assignmentIds } })
      .populate("academicPeriod", "name trimester schoolYear status")
      .lean();
    const activityIds = activities.map((activity) => activity._id);
    const [scores, gradebooks] = await Promise.all([
      activityIds.length ? Score.find({ student: student._id, activity: { $in: activityIds } }).lean() : [],
      Gradebook.find({ subjectAssignment: { $in: assignmentIds } }).populate("academicPeriod").lean(),
    ]);

    const scoreByActivity = new Map(scores.map((score) => [String(score.activity), score]));
    const activityById = new Map(activities.map((activity) => [String(activity._id), activity]));
    const gradebooksByAssignment = new Map();
    for (const gradebook of gradebooks) {
      const key = String(gradebook.subjectAssignment);
      gradebooksByAssignment.set(key, [...(gradebooksByAssignment.get(key) || []), gradebook]);
    }

    const subjects = await Promise.all(assignments.map(async (assignment) => {
      const assignmentActivities = activities.filter((activity) => String(activity.subjectAssignment) === String(assignment._id));
      const assignmentGradebooks = gradebooksByAssignment.get(String(assignment._id)) || [];
      const periods = (await Promise.all(assignmentGradebooks.map(async (gradebook) => {
        if (!gradebook.academicPeriod) return null;
        const completeness = await isAssignmentGradebookComplete(String(assignment._id), String(gradebook.academicPeriod._id));
        if (!completeness.complete) return null;
        const [grade] = await calculateAssignmentGrades(String(assignment._id), String(student._id), String(gradebook.academicPeriod._id));
        return grade ? { academicPeriod: gradebook.academicPeriod, finalizedAt: gradebook.finalizedAt, grade } : null;
      }))).filter(Boolean).sort((a, b) => new Date(b.finalizedAt || 0) - new Date(a.finalizedAt || 0));

      const completedActivities = assignmentActivities.filter((activity) => scoreByActivity.has(String(activity._id))).length;
      const hasActivePeriodActivities = assignmentActivities.some((activity) => activity.academicPeriod?.status === "active");
      return {
        subjectAssignment: assignment,
        subject: assignment.subject,
        class: assignment.class,
        teacher: assignment.teacher,
        periods,
        totalActivities: assignmentActivities.length,
        completedActivities,
        gradeStatus: periods.length ? "published" : hasActivePeriodActivities ? "awaiting_finalization" : "not_published",
      };
    }));

    const finalizedPeriodMap = new Map(gradebooks.map((gradebook) => [
      `${gradebook.subjectAssignment}:${gradebook.academicPeriod?._id || gradebook.academicPeriod}`,
      gradebook.finalizedAt,
    ]));
    const recentUpdates = scores
      .map((score) => {
        const activity = activityById.get(String(score.activity));
        if (!activity) return null;
        const publishedAt = finalizedPeriodMap.get(`${activity.subjectAssignment}:${activity.academicPeriod?._id || activity.academicPeriod}`);
        if (!publishedAt) return null;
        const assignment = assignments.find((item) => String(item._id) === String(activity.subjectAssignment));
        return {
          _id: score._id,
          subjectAssignmentId: activity.subjectAssignment,
          subject: assignment?.subject || "Subject",
          className: assignment?.class?.name || "Class",
          title: activity.title,
          score: score.score,
          totalPoints: activity.totalPoints,
          feedback: score.remarks || "",
          updatedAt: publishedAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    const publishedGrades = subjects.map((subject) => subject.periods[0]?.grade?.finalGrade).filter((grade) => grade !== null && grade !== undefined && Number.isFinite(Number(grade)));
    const currentAverage = publishedGrades.length
      ? Number((publishedGrades.reduce((sum, grade) => sum + Number(grade), 0) / publishedGrades.length).toFixed(1))
      : null;
    const now = new Date();
    const recentUpdatesCount = recentUpdates.filter((item) => new Date(item.updatedAt) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).length;

    return res.json({ subjects, recentUpdates: recentUpdates.slice(0, 6), currentAverage, recentUpdatesCount });
  } catch (error) {
    console.error("Error fetching student dashboard:", error.message);
    return res.status(500).json({ error: "Failed to load student dashboard" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/grades/student/me
// Returns the logged-in student's finalized and in-progress grades across classes.
// ---------------------------------------------------------------------------
router.get("/student/me", async (req, res) => {
  try {
    const userId = resolveUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "A valid login is required" });
    }

    const student = await Student.findOne({ user: userId }).lean();
    if (!student) {
      return res.status(404).json({ error: "Student profile not found" });
    }

    // Find all classes this student is enrolled in
    const classes = await Class.find({
      students: student._id,
    })
      .populate("teacher", "name")
      .lean();

    if (classes.length === 0) {
      return res.json([]);
    }

    const assignments = await SubjectAssignment.find({
      class: { $in: classes.map((classRecord) => classRecord._id) },
      active: true,
    })
      .populate("class")
      .populate("teacher", "name")
      .lean();

    const results = await Promise.all(assignments.map(async (assignment) => {
      const [gradebooks, academicPeriods, activities, scores] = await Promise.all([
        Gradebook.find({ subjectAssignment: assignment._id }).lean(),
        AcademicPeriod.find({ schoolYear: assignment.class.schoolYear }).sort({ trimester: 1 }).lean(),
        Activity.find({ subjectAssignment: assignment._id }).lean(),
        Score.find({ student: student._id, subjectAssignment: assignment._id }).lean(),
      ]);
      const scoreByActivity = new Map(scores.map((score) => [String(score.activity), score]));
      const periods = await Promise.all(academicPeriods.map(async (academicPeriod) => {
        const periodActivities = activities.filter((activity) => String(activity.academicPeriod) === String(academicPeriod._id));
        if (!periodActivities.length && academicPeriod.status !== "active") return null;
        const gradebook = gradebooks.find((item) => String(item.academicPeriod) === String(academicPeriod._id));
        const isFinalized = Boolean(gradebook?.finalizedAt);
        let grade;
        if (isFinalized) {
          const [gradeSummary] = await calculateAssignmentGrades(
            String(assignment._id),
            String(student._id),
            String(academicPeriod._id)
          );
          grade = gradeSummary || null;
        } else {
          const gradedActivities = periodActivities.filter((activity) => scoreByActivity.has(String(activity._id)));
          if (gradedActivities.length) {
            grade = calculateStudentGradeFromActivities({
              classRecord: assignment.class,
              gradingSystem: assignment.gradingSystem,
              activities: gradedActivities,
              scoresByActivityId: scoreByActivity,
            });
          }
        }
        return {
          academicPeriod,
          finalizedAt: gradebook?.finalizedAt || null,
          isFinalized,
          grade,
          activities: periodActivities
            .filter((activity) => scoreByActivity.has(String(activity._id)))
            .map((activity) => ({
              _id: activity._id,
              title: activity.title,
              gradingCategory: activity.gradingCategory,
              score: scoreByActivity.get(String(activity._id)).score,
              totalPoints: activity.totalPoints,
              remarks: scoreByActivity.get(String(activity._id)).remarks || "",
            })),
        };
      }));
      return {
        class: assignment.class,
        subjectAssignment: assignment,
        subject: assignment.subject,
        teacher: assignment.teacher,
        periods: periods.filter(Boolean),
      };
    }));

    return res.json(results);
  } catch (error) {
    console.error("Error fetching student grades:", error.message);
    return res.status(500).json({ error: "Failed to fetch student grades" });
  }
});

module.exports = router;
