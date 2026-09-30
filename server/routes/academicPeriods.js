const express = require("express");

const AcademicPeriod = require("../models/AcademicPeriod");

const router = express.Router();

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

router.post("/", async (req, res) => {
  try {
    const {
      schoolYear,
      trimester,
      name,
      startDate,
      endDate,
      status,
    } = req.body;

    if (
      !schoolYear ||
      trimester === undefined ||
      !name ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        error:
          "School year, trimester, name, start date, and end date are required",
      });
    }

    const period = await AcademicPeriod.create({
      schoolYear,
      trimester,
      name,
      startDate,
      endDate,
      status: status || "upcoming",
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

module.exports = router;