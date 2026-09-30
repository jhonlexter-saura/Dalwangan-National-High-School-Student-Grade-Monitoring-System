const express = require("express");

const Activity = require("../models/Activity");
const Class = require("../models/Class");
const AcademicPeriod = require("../models/AcademicPeriod");

const router = express.Router();

// GET all activities
router.get("/", async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate("class")
      .populate("academicPeriod")
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
    })
      .populate("academicPeriod")
      .sort({ date: -1 });

    res.json(activities);
  } catch (error) {
    console.error(
      "Error fetching class activities:",
      error.message
    );

    res.status(500).json({
      error: "Failed to fetch class activities",
    });
  }
});

// GET activities for a specific academic period
router.get(
  "/class/:classId/period/:academicPeriodId",
  async (req, res) => {
    try {
      const activities = await Activity.find({
        class: req.params.classId,
        academicPeriod: req.params.academicPeriodId,
      })
        .populate("academicPeriod")
        .sort({ date: -1 });

      res.json(activities);
    } catch (error) {
      console.error(
        "Error fetching period activities:",
        error.message
      );

      res.status(500).json({
        error: "Failed to fetch period activities",
      });
    }
  }
);

// GET one activity
router.get("/:id", async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate("class")
      .populate("academicPeriod");

    if (!activity) {
      return res.status(404).json({
        error: "Activity not found",
      });
    }

    res.json(activity);
  } catch (error) {
    console.error(
      "Error fetching activity:",
      error.message
    );

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
      academicPeriodId,
      type,
      totalPoints,
      date,
    } = req.body;

    if (
      !title ||
      !classId ||
      !academicPeriodId ||
      !type ||
      totalPoints === undefined ||
      !date
    ) {
      return res.status(400).json({
        error:
          "Title, class, academic period, type, total points, and date are required",
      });
    }

    // Verify class
    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        error: "Class not found",
      });
    }

    // Verify academic period
    const academicPeriod =
      await AcademicPeriod.findById(academicPeriodId);

    if (!academicPeriod) {
      return res.status(404).json({
        error: "Academic period not found",
      });
    }

    // Make sure the academic period belongs to
    // the same school year as the class.
    if (
      academicPeriod.schoolYear !==
      classData.schoolYear
    ) {
      return res.status(400).json({
        error:
          "Academic period does not belong to the class school year",
      });
    }

    const activity = await Activity.create({
      title: title.trim(),
      description: description?.trim() || "",
      class: classId,
      academicPeriod: academicPeriodId,
      type,
      totalPoints: Number(totalPoints),
      date,
    });

    const populatedActivity =
      await Activity.findById(activity._id)
        .populate("class")
        .populate("academicPeriod");

    res.status(201).json(populatedActivity);
  } catch (error) {
    console.error(
      "Error creating activity:",
      error.message
    );

    res.status(500).json({
      error: "Failed to create activity",
    });
  }
});

module.exports = router;