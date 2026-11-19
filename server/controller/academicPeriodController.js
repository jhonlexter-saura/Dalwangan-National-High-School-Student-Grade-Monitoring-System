const AcademicPeriod = require("../models/AcademicPeriod");
const Activity = require("../models/Activity");
const Class = require("../models/Class");
const { logAudit } = require("../services/auditLogger");

/* ---------- helpers (used only by this controller) ---------- */

async function findCalendarConflict(period, excludeId) {
  const overlap = await AcademicPeriod.findOne({
    startDate: { $lte: period.endDate },
    endDate: { $gte: period.startDate },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (overlap) return "The dates overlap another term in the school calendar";

  return null;
}

// Only one period may be active at a time. This was duplicated in POST and PATCH.
async function completeOtherActivePeriods(period) {
  if (period.status !== "active") return;
  await AcademicPeriod.updateMany(
    { _id: { $ne: period._id }, status: "active" },
    { $set: { status: "completed" } }
  );
}

const isoDate = (d) => d?.toISOString().slice(0, 10);

/* ---------- handlers ---------- */

async function getPeriods(req, res) {
  try {
    const filter = {};
    if (req.query.schoolYear) filter.schoolYear = req.query.schoolYear;

    const periods = await AcademicPeriod.find(filter).sort({
      schoolYear: -1,
      trimester: 1,
    });

    const withReferences = await Promise.all(
      periods.map(async (period) => {
        const [hasActivities, hasClasses] = await Promise.all([
          Activity.exists({ academicPeriod: period._id }),
          Class.exists({ schoolYear: period.schoolYear }),
        ]);
        return {
          ...period.toObject(),
          hasActivities: Boolean(hasActivities),
          hasClasses: Boolean(hasClasses),
        };
      })
    );

    res.json(withReferences);
  } catch (error) {
    console.error("Get academic periods error:", error);
    res.status(500).json({ error: "Failed to fetch academic periods" });
  }
}

async function createPeriod(req, res) {
  try {
    const periodData = req.periodData; // already validated by middleware

    const conflict = await findCalendarConflict(periodData);
    if (conflict) return res.status(409).json({ error: conflict });

    const period = await AcademicPeriod.create(periodData);
    await completeOtherActivePeriods(period);

    logAudit({
      req,
      action: "CALENDAR_PERIOD_CREATED",
      category: "calendar",
      target: {
        entityType: "AcademicPeriod",
        entityId: String(period._id),
        name: `${period.name} (${period.schoolYear})`,
      },
      description: `Created academic period '${period.name}' for S.Y. ${period.schoolYear} (${isoDate(period.startDate)} – ${isoDate(period.endDate)})`,
      details: {
        name: period.name,
        schoolYear: period.schoolYear,
        trimester: period.trimester,
        status: period.status,
        startDate: period.startDate,
        endDate: period.endDate,
      },
    });

    res.status(201).json(period);
  } catch (error) {
    console.error("Create academic period error:", error);

    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "This trimester already exists for this school year" });
    }
    res.status(500).json({ error: "Failed to create academic period" });
  }
}

async function updatePeriod(req, res) {
  try {
    const periodData = req.periodData;

    const period = await AcademicPeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json({ error: "Academic period not found" });
    }

    if (period.schoolYear !== periodData.schoolYear) {
      const hasActivities = await Activity.exists({ academicPeriod: period._id });
      if (hasActivities) {
        return res.status(409).json({
          error: "The school year cannot be changed after activities use this term",
        });
      }
    }

    const activitiesOutsideDates = await Activity.exists({
      academicPeriod: period._id,
      $or: [
        { date: { $lt: periodData.startDate } },
        { date: { $gt: periodData.endDate } },
      ],
    });
    if (activitiesOutsideDates) {
      return res
        .status(409)
        .json({ error: "The new term dates would exclude existing activities" });
    }

    const conflict = await findCalendarConflict(periodData, period._id);
    if (conflict) return res.status(409).json({ error: conflict });

    Object.assign(period, periodData);
    await period.save();
    await completeOtherActivePeriods(period);

    logAudit({
      req,
      action: "CALENDAR_PERIOD_UPDATED",
      category: "calendar",
      target: {
        entityType: "AcademicPeriod",
        entityId: String(period._id),
        name: `${period.name} (${period.schoolYear})`,
      },
      description: `Updated academic period '${period.name}' for S.Y. ${period.schoolYear}`,
      details: {
        name: period.name,
        schoolYear: period.schoolYear,
        status: period.status,
        startDate: period.startDate,
        endDate: period.endDate,
      },
    });

    return res.json(period);
  } catch (error) {
    console.error("Update academic period error:", error);
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "This trimester already exists for this school year" });
    }
    return res.status(500).json({ error: "Failed to update academic period" });
  }
}

async function deletePeriod(req, res) {
  try {
    const period = await AcademicPeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json({ error: "Academic period not found" });
    }

    const [hasActivities, hasClasses] = await Promise.all([
      Activity.exists({ academicPeriod: period._id }),
      Class.exists({ schoolYear: period.schoolYear }),
    ]);
    if (period.status === "active" || hasActivities || hasClasses) {
      return res.status(409).json({
        error:
          "An active school year or a year with existing classes or activities cannot be deleted",
      });
    }

    await period.deleteOne();

    logAudit({
      req,
      action: "CALENDAR_PERIOD_DELETED",
      category: "calendar",
      target: {
        entityType: "AcademicPeriod",
        entityId: String(period._id),
        name: `${period.name} (${period.schoolYear})`,
      },
      description: `Deleted academic period '${period.name}' for S.Y. ${period.schoolYear}`,
      details: {
        name: period.name,
        schoolYear: period.schoolYear,
        trimester: period.trimester,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete academic period error:", error);
    return res.status(500).json({ error: "Failed to delete academic period" });
  }
}

module.exports = { getPeriods, createPeriod, updatePeriod, deletePeriod };