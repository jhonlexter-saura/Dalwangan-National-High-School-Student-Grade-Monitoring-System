const express = require("express");

const Activity = require("../models/Activity");
const Class = require("../models/Class");
const AcademicPeriod = require("../models/AcademicPeriod");
const SubjectAssignment = require("../models/SubjectAssignment");
const Teacher = require("../models/Teacher");
const { requireAuthenticatedUser } = require("../middleware/authorization");
const { logAudit } = require("../services/auditLogger");

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
      .populate("subjectAssignment")
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

router.get("/assignment/:assignmentId", requireAuthenticatedUser, async (req, res) => {
  try {
    const assignment = await SubjectAssignment.findById(req.params.assignmentId).select("teacher").lean();
    if (!assignment) return res.status(404).json({ error: "Subject assignment not found" });
    if (req.authenticatedUser.role !== "admin") {
      const teacher = await Teacher.findOne({ user: req.authenticatedUser._id }).select("_id").lean();
      if (req.authenticatedUser.role !== "teacher" || !teacher || String(assignment.teacher) !== String(teacher._id)) {
        return res.status(403).json({ error: "You can only view activities for your subject assignments" });
      }
    }
    const activities = await Activity.find({ subjectAssignment: req.params.assignmentId })
      .populate("class")
      .populate("subjectAssignment")
      .populate("academicPeriod")
      .sort({ date: -1 });
    return res.json(activities);
  } catch (error) {
    console.error("Error fetching assignment activities:", error.message);
    return res.status(500).json({ error: "Failed to fetch assignment activities" });
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
router.post("/", requireAuthenticatedUser, async (req, res) => {
  try {
    const {
      title,
      description,
      classId,
      subjectAssignmentId,
      academicPeriodId,
      type,
      gradingCategory,
      totalPoints,
      date,
    } = req.body;

    const defaultCategoryByType = {
      quiz: "written_work",
      assignment: "written_work",
      project: "performance_task",
      performance_task: "performance_task",
      exam: "assessment",
      activity: "written_work",
    };

    const resolvedGradingCategory =
      gradingCategory || defaultCategoryByType[type];

    if (!resolvedGradingCategory) {
      return res.status(400).json({
        error: "A valid grading category is required",
      });
    }

    // Validate required fields
    if (
      !title?.trim() ||
      !classId ||
      !subjectAssignmentId ||
      !academicPeriodId ||
      !type ||
      totalPoints === undefined ||
      totalPoints === null ||
      totalPoints === "" ||
      !date
    ) {
      return res.status(400).json({
        error:
          "Title, class, subject, academic period, type, total points, and date are required",
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

    const subjectAssignment = await SubjectAssignment.findOne({
      _id: subjectAssignmentId,
      class: classId,
      active: true,
    });
    if (!subjectAssignment) {
      return res.status(400).json({ error: "Subject assignment does not belong to this class" });
    }
    if (req.authenticatedUser.role !== "admin") {
      const teacher = await Teacher.findOne({ user: req.authenticatedUser._id }).select("_id").lean();
      if (req.authenticatedUser.role !== "teacher" || !teacher || String(subjectAssignment.teacher) !== String(teacher._id)) {
        return res.status(403).json({ error: "You can only create activities for your subject assignments" });
      }
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
      subjectAssignment: subjectAssignmentId,
      academicPeriod: academicPeriodId,
      type,
      gradingCategory: resolvedGradingCategory,
      totalPoints: points,
      date,
    });

    // Return populated activity
    const populatedActivity = await Activity.findById(activity._id)
      .populate("class")
      .populate("subjectAssignment")
      .populate("academicPeriod");

    logAudit({
      req,
      action: "ACTIVITY_CREATED",
      category: "activities",
      target: {
        entityType: "Activity",
        entityId: String(activity._id),
        name: activity.title,
      },
      description: `Created activity '${activity.title}' (${activity.type}, ${points} pts) for ${classData.name} - ${subjectAssignment.subject}`,
      details: {
        title: activity.title,
        type: activity.type,
        category: resolvedGradingCategory,
        totalPoints: points,
        classId: classData._id,
        className: classData.name,
        subject: subjectAssignment.subject,
        periodName: academicPeriod.name,
        date: activity.date,
      },
    });

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
