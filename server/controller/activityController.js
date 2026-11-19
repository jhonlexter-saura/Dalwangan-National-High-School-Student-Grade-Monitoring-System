const Activity = require("../models/Activity");
const Class = require("../models/Class");
const AcademicPeriod = require("../models/AcademicPeriod");
const SubjectAssignment = require("../models/SubjectAssignment");
const Gradebook = require("../models/Gradebook");
const Score = require("../models/Score");
const { logAudit } = require("../services/auditLogger");
const { canManageAssignment } = require("../services/assignmentAccess");

/* ---------- helpers (used only by this controller) ---------- */

// Same three populates were repeated in 4 places.
const withFullRefs = (query) =>
  query.populate("class").populate("subjectAssignment").populate("academicPeriod");

// Was copy-pasted in create / update / delete (only the message differed).
const isGradebookFinalized = (subjectAssignment, academicPeriod) =>
  Gradebook.exists({ subjectAssignment, academicPeriod });

/* ---------- read handlers ---------- */

async function getActivities(req, res) {
  try {
    const activities = await Activity.find()
      .populate("class")
      .populate("academicPeriod")
      .sort({ date: -1 });

    res.json(activities);
  } catch (error) {
    console.error("Error fetching activities:", error.message);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
}

async function getClassActivities(req, res) {
  try {
    const activities = await Activity.find({ class: req.params.classId })
      .populate("subjectAssignment")
      .populate("academicPeriod")
      .sort({ date: -1 });

    res.json(activities);
  } catch (error) {
    console.error("Error fetching class activities:", error.message);
    res.status(500).json({ error: "Failed to fetch class activities" });
  }
}

async function getAssignmentActivities(req, res) {
  try {
    const assignment = await SubjectAssignment.findById(req.params.assignmentId)
      .select("teacher")
      .lean();
    if (!assignment) {
      return res.status(404).json({ error: "Subject assignment not found" });
    }

    if (!(await canManageAssignment(req.authenticatedUser, assignment))) {
      return res
        .status(403)
        .json({ error: "You can only view activities for your subject assignments" });
    }

    const activities = await withFullRefs(
      Activity.find({ subjectAssignment: req.params.assignmentId })
    ).sort({ date: -1 });

    return res.json(activities);
  } catch (error) {
    console.error("Error fetching assignment activities:", error.message);
    return res.status(500).json({ error: "Failed to fetch assignment activities" });
  }
}

async function getClassPeriodActivities(req, res) {
  try {
    const activities = await Activity.find({
      class: req.params.classId,
      academicPeriod: req.params.academicPeriodId,
    })
      .populate("academicPeriod")
      .sort({ date: -1 });

    res.json(activities);
  } catch (error) {
    console.error("Error fetching period activities:", error.message);
    res.status(500).json({ error: "Failed to fetch period activities" });
  }
}

async function getActivity(req, res) {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate("class")
      .populate("academicPeriod");

    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }

    res.json(activity);
  } catch (error) {
    console.error("Error fetching activity:", error.message);
    res.status(500).json({ error: "Failed to fetch activity" });
  }
}

/* ---------- write handlers ---------- */

async function createActivity(req, res) {
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
    } = req.activityData; // already validated + cleaned by middleware

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }

    const subjectAssignment = await SubjectAssignment.findOne({
      _id: subjectAssignmentId,
      class: classId,
      active: true,
    });
    if (!subjectAssignment) {
      return res
        .status(400)
        .json({ error: "Subject assignment does not belong to this class" });
    }
    if (!(await canManageAssignment(req.authenticatedUser, subjectAssignment))) {
      return res
        .status(403)
        .json({ error: "You can only create activities for your subject assignments" });
    }

    const academicPeriod = await AcademicPeriod.findById(academicPeriodId);
    if (!academicPeriod) {
      return res.status(404).json({ error: "Academic period not found" });
    }
    if (String(academicPeriod.schoolYear) !== String(classData.schoolYear)) {
      return res
        .status(400)
        .json({ error: "Academic period does not belong to the class school year" });
    }

    if (await isGradebookFinalized(subjectAssignmentId, academicPeriodId)) {
      return res.status(409).json({
        error:
          "This gradebook is finalized. Ask an administrator to unlock it before adding activities.",
      });
    }

    const activity = await Activity.create({
      title,
      description,
      class: classId,
      subjectAssignment: subjectAssignmentId,
      academicPeriod: academicPeriodId,
      type,
      gradingCategory,
      totalPoints,
      date,
    });

    const populatedActivity = await withFullRefs(Activity.findById(activity._id));

    logAudit({
      req,
      action: "ACTIVITY_CREATED",
      category: "activities",
      target: {
        entityType: "Activity",
        entityId: String(activity._id),
        name: activity.title,
      },
      description: `Created activity '${activity.title}' (${activity.type}, ${totalPoints} pts) for ${classData.name} - ${subjectAssignment.subject}`,
      details: {
        title: activity.title,
        type: activity.type,
        category: gradingCategory,
        totalPoints,
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

    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === "CastError") {
      return res.status(400).json({ error: `Invalid value for ${error.path}` });
    }
    return res.status(500).json({ error: "Failed to create activity" });
  }
}

async function updateActivity(req, res) {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    const subjectAssignment = await SubjectAssignment.findById(
      activity.subjectAssignment
    ).lean();
    if (!subjectAssignment) {
      return res.status(400).json({ error: "Subject assignment not found" });
    }

    if (!(await canManageAssignment(req.authenticatedUser, subjectAssignment))) {
      return res
        .status(403)
        .json({ error: "You can only edit activities for your subject assignments" });
    }

    if (await isGradebookFinalized(activity.subjectAssignment, activity.academicPeriod)) {
      return res.status(409).json({
        error:
          "This gradebook is finalized. Ask an administrator to unlock it before editing activities.",
      });
    }

    Object.assign(activity, req.activityUpdates); // only fields validated by middleware
    await activity.save();

    const populated = await withFullRefs(Activity.findById(activity._id));

    logAudit({
      req,
      action: "ACTIVITY_UPDATED",
      category: "activities",
      target: { entityType: "Activity", entityId: String(activity._id), name: activity.title },
      description: `Updated activity '${activity.title}'`,
    });

    return res.json(populated);
  } catch (error) {
    console.error("Error updating activity:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to update activity" });
  }
}

async function deleteActivity(req, res) {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    const subjectAssignment = await SubjectAssignment.findById(
      activity.subjectAssignment
    ).lean();
    if (!subjectAssignment) {
      return res.status(400).json({ error: "Subject assignment not found" });
    }

    if (!(await canManageAssignment(req.authenticatedUser, subjectAssignment))) {
      return res
        .status(403)
        .json({ error: "You can only delete activities for your subject assignments" });
    }

    if (await isGradebookFinalized(activity.subjectAssignment, activity.academicPeriod)) {
      return res.status(409).json({
        error:
          "This gradebook is finalized. Ask an administrator to unlock it before deleting activities.",
      });
    }

    await Score.deleteMany({ activity: activity._id });
    await activity.deleteOne();

    logAudit({
      req,
      action: "ACTIVITY_DELETED",
      category: "activities",
      target: { entityType: "Activity", entityId: String(req.params.id), name: activity.title },
      description: `Deleted activity '${activity.title}' and its scores`,
    });

    return res.json({ message: "Activity and associated scores deleted" });
  } catch (error) {
    console.error("Error deleting activity:", error);
    return res.status(500).json({ error: "Failed to delete activity" });
  }
}

module.exports = {
  getActivities,
  getClassActivities,
  getAssignmentActivities,
  getClassPeriodActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
};