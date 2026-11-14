const express = require("express");
const mongoose = require("mongoose");

const AcademicPeriod = require("../models/AcademicPeriod");
const Activity = require("../models/Activity");
const { requireAdmin } = require("../middleware/authorization");
const { logAudit } = require("../services/auditLogger");

const router = express.Router();

function validatePeriod(input) {
  const schoolYear =
    typeof input.schoolYear === "string" ? input.schoolYear.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const trimester = Number(input.trimester);
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const status = input.status || "upcoming";

  if (!schoolYear || !name || !input.startDate || !input.endDate) {
    return {
      error: "School year, trimester, name, start date, and end date are required",
    };
  }
  if (!Number.isInteger(trimester) || trimester < 1 || trimester > 3) {
    return { error: "Trimester must be 1, 2, or 3" };
  }
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate >= endDate
  ) {
    return { error: "Enter valid dates with the end date after the start date" };
  }
  if (!["upcoming", "active", "completed"].includes(status)) {
    return { error: "Status must be upcoming, active, or completed" };
  }

  return { schoolYear, trimester, name, startDate, endDate, status };
}

async function findCalendarConflict(period, excludeId) {
  const overlap = await AcademicPeriod.findOne({
    startDate: { $lte: period.endDate },
    endDate: { $gte: period.startDate },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (overlap) return "The dates overlap another term in the school calendar";

  if (period.status === "active") {
    const activePeriod = await AcademicPeriod.findOne({
      status: "active",
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (activePeriod) return "Another academic period is already active";
  }

  return null;
}

router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.schoolYear) {
      filter.schoolYear = req.query.schoolYear;
    }

    const periods = await AcademicPeriod.find(filter)
      .sort({ schoolYear: -1, trimester: 1 });

    res.json(periods);
  } catch (error) {
    console.error("Get academic periods error:", error);

    res.status(500).json({
      error: "Failed to fetch academic periods",
    });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const periodData = validatePeriod(req.body || {});
    if (periodData.error) return res.status(400).json({ error: periodData.error });

    const conflict = await findCalendarConflict(periodData);
    if (conflict) return res.status(409).json({ error: conflict });

    const period = await AcademicPeriod.create(periodData);

    logAudit({
      req,
      action: "CALENDAR_PERIOD_CREATED",
      category: "calendar",
      target: {
        entityType: "AcademicPeriod",
        entityId: String(period._id),
        name: `${period.name} (${period.schoolYear})`,
      },
      description: `Created academic period '${period.name}' for S.Y. ${period.schoolYear} (${period.startDate?.toISOString().slice(0, 10)} – ${period.endDate?.toISOString().slice(0, 10)})`,
      details: { name: period.name, schoolYear: period.schoolYear, trimester: period.trimester, status: period.status, startDate: period.startDate, endDate: period.endDate },
    });

    res.status(201).json(period);
  } catch (error) {
    console.error("Create academic period error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        error:
          "This trimester already exists for this school year",
      });
    }

    res.status(500).json({
      error: "Failed to create academic period",
    });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid academic period ID" });
    }
    const periodData = validatePeriod(req.body || {});
    if (periodData.error) return res.status(400).json({ error: periodData.error });

    const period = await AcademicPeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json({ error: "Academic period not found" });
    }

    if (period.schoolYear !== periodData.schoolYear) {
      const hasActivities = await Activity.exists({
        academicPeriod: period._id,
      });
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
      return res.status(409).json({
        error: "The new term dates would exclude existing activities",
      });
    }

    const conflict = await findCalendarConflict(periodData, period._id);
    if (conflict) return res.status(409).json({ error: conflict });

    Object.assign(period, periodData);
    await period.save();

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
      details: { name: period.name, schoolYear: period.schoolYear, status: period.status, startDate: period.startDate, endDate: period.endDate },
    });

    return res.json(period);
  } catch (error) {
    console.error("Update academic period error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        error: "This trimester already exists for this school year",
      });
    }
    return res.status(500).json({ error: "Failed to update academic period" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid academic period ID" });
    }
    const period = await AcademicPeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json({ error: "Academic period not found" });
    }

    const hasActivities = await Activity.exists({
      academicPeriod: period._id,
    });
    if (hasActivities) {
      return res.status(409).json({
        error: "This academic period is used by activities and cannot be deleted",
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
      details: { name: period.name, schoolYear: period.schoolYear, trimester: period.trimester },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete academic period error:", error);
    return res.status(500).json({ error: "Failed to delete academic period" });
  }
});

module.exports = router;