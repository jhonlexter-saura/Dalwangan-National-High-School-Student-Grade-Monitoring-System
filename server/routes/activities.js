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
      gradingCategory,
      totalPoints,
      date,
    } = req.body;

    // Validate required fields
    if (
      !title?.trim() ||
      !classId ||
      !academicPeriodId ||
      !type ||
      !gradingCategory ||
      totalPoints === undefined ||
      totalPoints === null ||
      totalPoints === "" ||
      !date
    ) {
      return res.status(400).json({
        error:
          "Title, class, academic period, type, grading category, total points, and date are required",
      });
    }

    // Validate points
    const points = Number(totalPoints);

    if (!Number.isFinite(points) || points <= 0) {
      return res.status(400).json({
        error: "Total points must be a number greater than zero",
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

    // Verify that the period belongs to the class's school year
    if (
      String(academicPeriod.schoolYear) !==
      String(classData.schoolYear)
    ) {
      return res.status(400).json({
        error:
          "Academic period does not belong to the class school year",
      });
    }

    // Create activity, including the required grading category
    const activity = await Activity.create({
      title: title.trim(),
      description: description?.trim() || "",
      class: classId,
      academicPeriod: academicPeriodId,
      type,
      gradingCategory,
      totalPoints: points,
      date,
    });

    // Return populated activity
    const populatedActivity = await Activity.findById(activity._id)
      .populate("class")
      .populate("academicPeriod");

    return res.status(201).json(populatedActivity);
  } catch (error) {
    console.error("Error creating activity:", error);

    // Surface validation errors to the frontend
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: error.message,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        error: `Invalid value for ${error.path}`,
      });
    }

    return res.status(500).json({
      error: "Failed to create activity",
    });
  }
});

module.exports = router;