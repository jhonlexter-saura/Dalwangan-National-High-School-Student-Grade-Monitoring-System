const express = require("express");
const Class = require("../models/Class");

const router = express.Router();

// GET all classes
router.get("/", async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("students")
      .sort({ createdAt: -1 });

    res.json(classes);
  } catch (error) {
    console.error("Error fetching classes:", error.message);
    res.status(500).json({
      error: "Failed to fetch classes",
    });
  }
});

// GET one class
router.get("/:id", async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id).populate("students");

    if (!classData) {
      return res.status(404).json({
        error: "Class not found",
      });
    }

    res.json(classData);
  } catch (error) {
    console.error("Error fetching class:", error.message);
    res.status(500).json({
      error: "Failed to fetch class",
    });
  }
});

// CREATE class
router.post("/", async (req, res) => {
  try {
    const { name, section, gradeLevel, adviser, schoolYear } = req.body;

    if (!name || !section || !gradeLevel || !adviser || !schoolYear) {
      return res.status(400).json({
        error: "All class fields are required",
      });
    }

    const newClass = await Class.create({
      name,
      section,
      gradeLevel,
      adviser,
      schoolYear,
      students: [],
    });

    res.status(201).json(newClass);
  } catch (error) {
    console.error("Error creating class:", error.message);
    res.status(500).json({
      error: "Failed to create class",
    });
  }
});

module.exports = router;