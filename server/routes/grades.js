const express = require("express");
const mongoose = require("mongoose");

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
const {
  getTokenUserId,
  requireAuthenticatedUser,
} = require("../middleware/authorization");

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
// GET /api/grades/student/me
// Returns all finalized grades for the logged-in student across every class.
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
      const gradebooks = await Gradebook.find({ subjectAssignment: assignment._id })
        .populate("academicPeriod")
        .lean();
      const periods = await Promise.all(gradebooks.map(async (gradebook) => {
        if (!gradebook.academicPeriod) return null;
        const completeness = await isAssignmentGradebookComplete(
          String(assignment._id),
          String(gradebook.academicPeriod._id)
        );
        if (!completeness.complete) return null;
        const [gradeSummary] = await calculateAssignmentGrades(
          String(assignment._id),
          String(student._id),
          String(gradebook.academicPeriod._id)
        );
        return {
          academicPeriod: gradebook.academicPeriod,
          finalizedAt: gradebook.finalizedAt,
          grade: gradeSummary || null,
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
