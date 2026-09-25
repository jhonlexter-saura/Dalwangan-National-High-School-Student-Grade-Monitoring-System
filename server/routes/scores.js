const express = require("express");
const Score = require("../models/Score");
const Student = require("../models/Student");
const Class = require("../models/Class");
const Activity = require("../models/Activity");

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

// CREATE or update a score
router.post("/", async (req, res) => {
  try {
    const {
      studentId,
      classId,
      activityId,
      score,
      remarks,
    } = req.body;

    if (
      !studentId ||
      !classId ||
      !activityId ||
      score === undefined
    ) {
      return res.status(400).json({
        error: "Student, class, activity, and score are required",
      });
    }

    const student = await Student.findById(studentId);
    const classData = await Class.findById(classId);
    const activity = await Activity.findById(activityId);

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

    if (Number(score) < 0 || Number(score) > activity.totalPoints) {
      return res.status(400).json({
        error: `Score must be between 0 and ${activity.totalPoints}`,
      });
    }

    const savedScore = await Score.findOneAndUpdate(
      {
        student: studentId,
        activity: activityId,
      },
      {
        student: studentId,
        class: classId,
        activity: activityId,
        score: Number(score),
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
      .populate("activity");

    res.status(200).json(savedScore);
  } catch (error) {
    console.error("Error saving score:", error.message);
    res.status(500).json({
      error: "Failed to save score",
    });
  }
});

module.exports = router;