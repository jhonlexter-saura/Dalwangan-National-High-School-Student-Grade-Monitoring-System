const express = require("express");
const Score = require("../models/Score");
const Student = require("../models/Student");
const Class = require("../models/Class");
const Activity = require("../models/Activity");
const SubjectAssignment = require("../models/SubjectAssignment");
const Teacher = require("../models/Teacher");
const Gradebook = require("../models/Gradebook");
const Notification = require("../models/Notification");
const { requireAuthenticatedUser } = require("../middleware/authorization");
const { lockGradebookForScore } = require("../middleware/gradebookLock");
const { validateScoreInput } = require("../middleware/validation");
const { logAudit } = require("../services/auditLogger");

const router = express.Router();

// GET all scores
router.get("/", async (req, res) => {
  try {
    const scores = await Score.find()
      .populate("student")
      .populate("class")
      .populate("activity")
      .sort({ createdAt: -1 });

    res.json(scores);
  } catch (error) {
    console.error("Error fetching scores:", error.message);
    res.status(500).json({
      error: "Failed to fetch scores",
    });
  }
});

// GET scores for a class
router.get("/class/:classId", async (req, res) => {
  try {
    const scores = await Score.find({
      class: req.params.classId,
    })
      .populate("student")
      .populate("activity")
      .sort({ createdAt: -1 });

    res.json(scores);
  } catch (error) {
    console.error("Error fetching class scores:", error.message);
    res.status(500).json({
      error: "Failed to fetch class scores",
    });
  }
});

// GET scores for an activity
router.get("/activity/:activityId", async (req, res) => {
  try {
    const scores = await Score.find({
      activity: req.params.activityId,
    })
      .populate("student")
      .populate("class")
      .sort({ createdAt: -1 });

    res.json(scores);
  } catch (error) {
    console.error("Error fetching activity scores:", error.message);
    res.status(500).json({
      error: "Failed to fetch activity scores",
    });
  }
});

router.get("/assignment/:assignmentId", async (req, res) => {
  try {
    const scores = await Score.find({ subjectAssignment: req.params.assignmentId })
      .populate("student")
      .populate("activity")
      .sort({ createdAt: -1 });
    return res.json(scores);
  } catch (error) {
    console.error("Error fetching assignment scores:", error.message);
    return res.status(500).json({ error: "Failed to fetch assignment scores" });
  }
});

// CREATE or update a score
router.post("/", requireAuthenticatedUser, lockGradebookForScore, validateScoreInput, async (req, res) => {
  try {
    const {
      studentId,
      classId,
      subjectAssignmentId,
      activityId,
      score,
      remarks,
    } = req.body;

    if (
      !studentId ||
      !classId ||
      !subjectAssignmentId ||
      !activityId ||
      score === undefined
    ) {
      return res.status(400).json({
        error: "Student, class, activity, and score are required",
      });
    }

    const student = await Student.findById(studentId);
    const classData = await Class.findById(classId);
    const activity = req.gradebookActivity || await Activity.findById(activityId);
    const subjectAssignment = await SubjectAssignment.findOne({
      _id: subjectAssignmentId,
      class: classId,
      active: true,
    });

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

    if (!activity) {
      return res.status(404).json({
        error: "Activity not found",
      });
    }

    if (
      !subjectAssignment ||
      String(activity.class) !== String(classId) ||
      String(activity.subjectAssignment) !== String(subjectAssignment._id)
    ) {
      return res.status(400).json({ error: "Activity does not belong to this subject assignment" });
    }
    if (req.authenticatedUser.role !== "admin") {
      const teacher = await Teacher.findOne({ user: req.authenticatedUser._id }).select("_id").lean();
      if (req.authenticatedUser.role !== "teacher" || !teacher || String(subjectAssignment.teacher) !== String(teacher._id)) {
        return res.status(403).json({ error: "You can only enter scores for your subject assignments" });
      }
    }

    const finalizedGradebook = await Gradebook.exists({
      subjectAssignment: subjectAssignmentId,
      academicPeriod: activity.academicPeriod,
    });
    if (finalizedGradebook) {
      return res.status(409).json({ error: "This gradebook is finalized. Ask an administrator to unlock it before changing scores." });
    }

    const existingScore = await Score.findOne({
      student: studentId,
      activity: activityId,
    }).lean();

    const savedScore = await Score.findOneAndUpdate(
      {
        student: studentId,
        activity: activityId,
      },
      {
        student: studentId,
        class: classId,
        subjectAssignment: subjectAssignmentId,
        activity: activityId,
        score: req.validatedScore,
        remarks: remarks || "",
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
      }
    )
      .populate("student")
      .populate("class")
      .populate("subjectAssignment")
      .populate("activity");

    const previousScore = existingScore ? existingScore.score : null;
    const isUpdate = existingScore !== null;
    const scoreDiff = isUpdate
      ? `from ${previousScore} to ${score}`
      : `${score}/${activity.totalPoints}`;

    logAudit({
      req,
      action: isUpdate ? "SCORE_UPDATED" : "SCORE_RECORDED",
      category: "grades",
      target: {
        entityType: "Score",
        entityId: String(savedScore._id),
        name: `${student.name} · ${activity.title} (${score}/${activity.totalPoints})`,
      },
      description: `${isUpdate ? "Updated" : "Recorded"} score for ${student.name} in '${activity.title}' (${scoreDiff})`,
      details: {
        studentId: student._id,
        studentName: student.name,
        activityId: activity._id,
        activityTitle: activity.title,
        totalPoints: activity.totalPoints,
        classId: classData._id,
        className: classData.name,
        subject: subjectAssignment?.subject || "",
        previousScore,
        newScore: Number(score),
        remarks: remarks || "",
      },
    });

    if (!existingScore || Number(existingScore.score) !== Number(score) || (existingScore.remarks || "") !== (remarks || "")) {
      try {
        await Notification.create({
          recipient: student.user,
          type: "score_received",
          title: "New activity score",
          message: `You received ${Number(score)}/${activity.totalPoints} for ${activity.title} in ${subjectAssignment.subject}.`,
          link: `/student/grades?assignmentId=${subjectAssignment._id}`,
        });
      } catch (notificationError) {
        console.error("Failed to notify student about score:", notificationError.message);
      }
    }

    res.status(200).json(savedScore);
  } catch (error) {
    console.error("Error saving score:", error.message);
    res.status(500).json({
      error: "Failed to save score",
    });
  }
});

module.exports = router;
