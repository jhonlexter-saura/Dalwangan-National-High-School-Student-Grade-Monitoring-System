const express = require("express");
const Activity = require("../models/Activity");
const Class = require("../models/Class");

const router = express.Router();

// GET all activities
router.get("/", async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate("class")
      .sort({ date: -1 });

    res.json(activities);
  } catch (error) {
    console.error("Error fetching activities:", error.message);
    res.status(500).json({
      error: "Failed to fetch activities",
    });
  }
});

// GET activities for a specific class
router.get("/class/:classId", async (req, res) => {
  try {
    const activities = await Activity.find({
      class: req.params.classId,
    }).sort({ date: -1 });

    res.json(activities);
  } catch (error) {
    console.error("Error fetching class activities:", error.message);
    res.status(500).json({
      error: "Failed to fetch class activities",
    });
  }
});

// GET one activity
router.get("/:id", async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id).populate("class");

    if (!activity) {
      return res.status(404).json({
        error: "Activity not found",
      });
    }

    res.json(activity);
  } catch (error) {
    console.error("Error fetching activity:", error.message);
    res.status(500).json({
      error: "Failed to fetch activity",
    });
  }
});

// CREATE activity
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      classId,
      type,
      totalPoints,
      date,
    } = req.body;

    if (!title || !classId || !type || totalPoints === undefined || !date) {
      return res.status(400).json({
        error: "Title, class, type, total points, and date are required",
      });
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        error: "Class not found",
      });
    }

    const activity = await Activity.create({
      title,
      description,
      class: classId,
      type,
      totalPoints,
      date,
    });

    const populatedActivity = await Activity.findById(activity._id).populate(
      "class"
    );

    res.status(201).json(populatedActivity);
  } catch (error) {
    console.error("Error creating activity:", error.message);
    res.status(500).json({
      error: "Failed to create activity",
    });
  }
});

module.exports = router;