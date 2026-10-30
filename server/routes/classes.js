const express = require("express");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher")

const router = express.Router();

function normalizeGradingSystem(gradingSystem) {
  const normalizedGradingSystem = gradingSystem?.enabled
    ? {
        enabled: true,
        components: Array.isArray(gradingSystem.components)
          ? gradingSystem.components
          : [],
      }
    : {
        enabled: false,
        components: [],
      };

  if (normalizedGradingSystem.enabled) {
    const totalPercentage = normalizedGradingSystem.components.reduce(
      (sum, component) => sum + Number(component?.percentage || 0),
      0
    );

    if (totalPercentage !== 100) {
      return null;
    }
  }

  return normalizedGradingSystem;
}

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

router.get("/teacher/:userId", async (req, res) => {
  try {
    const teacher = await Teacher.findOne({
      user: req.params.userId,
    });

    if (!teacher) {
      return res.status(404).json({
        error: "Teacher profile not found",
      });
    }

    const classes = await Class.find({
      teacher: teacher._id,
    })
      .populate("teacher")
      .populate("students")
      .sort({ createdAt: -1 });

    res.json(classes);
  } catch (error) {
    console.error("Get teacher classes error:", error);

    res.status(500).json({
      error: "Failed to fetch teacher classes",
    });
  }
});

router.post("/teacher/:userId", async (req, res) => {
  try {
    const {
      name,
      section,
      gradeLevel,
      schoolYear,
      gradingSystem,
    } = req.body;

    if (!name || !section || gradeLevel === undefined || !schoolYear) {
      return res.status(400).json({
        error: "Name, section, grade level, and school year are required",
      });
    }

    const normalizedGradingSystem = normalizeGradingSystem(gradingSystem);

    if (!normalizedGradingSystem) {
      return res.status(400).json({
        error: "Grading percentages must total 100%",
      });
    }

    const teacher = await Teacher.findOne({
      user: req.params.userId,
    });

    if (!teacher) {
      return res.status(404).json({
        error: "Teacher profile not found",
      });
    }

    const newClass = await Class.create({
      name: name.trim(),
      section: section.trim(),
      gradeLevel: Number(gradeLevel),
      teacher: teacher._id,
      schoolYear: schoolYear.trim(),
      students: [],
      gradingSystem: normalizedGradingSystem,
    });

    const populatedClass = await Class.findById(newClass._id)
      .populate("teacher")
      .populate("students");

    res.status(201).json(populatedClass);
  } catch (error) {
    console.error("Create teacher class error:", error);

    res.status(500).json({
      error: "Failed to create class",
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
    const {
      name,
      section,
      gradeLevel,
      teacher: teacherId,
      schoolYear,
      gradingSystem,
    } = req.body;

    if (!name || !section || gradeLevel === undefined || !schoolYear) {
      return res.status(400).json({
        error: "Class name, section, grade level, and school year are required",
      });
    }

    if (teacherId && !/^[a-f\d]{24}$/i.test(String(teacherId))) {
      return res.status(400).json({
        error: "Invalid teacher",
      });
    }

    const normalizedGradingSystem = normalizeGradingSystem(gradingSystem);

    if (!normalizedGradingSystem) {
      return res.status(400).json({
        error: "Grading percentages must total 100%",
      });
    }

    const teacherProfile = teacherId
      ? await Teacher.findOne({ user: teacherId })
      : null;

    if (teacherId && !teacherProfile) {
      return res.status(404).json({
        error: "Teacher profile not found",
      });
    }

    const newClass = await Class.create({
      name: name.trim(),
      section: section.trim(),
      gradeLevel: Number(gradeLevel),
      teacher: teacherProfile?._id || null,
      schoolYear: schoolYear.trim(),
      students: [],
      gradingSystem: normalizedGradingSystem,
    });

    const populatedClass = await Class.findById(newClass._id)
      .populate("teacher")
      .populate("students");

    res.status(201).json(populatedClass);
  } catch (error) {
    console.error("Error creating class:", error.message);
    res.status(500).json({
      error: "Failed to create class",
    });
  }
});

// UPDATE class
router.put("/:id", async (req, res) => {
  try {
    const { name, section, gradeLevel, schoolYear } = req.body;
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (section) updateData.section = section.trim();
    if (gradeLevel !== undefined) updateData.gradeLevel = Number(gradeLevel);
    if (schoolYear) updateData.schoolYear = schoolYear.trim();

    const updated = await Class.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("teacher")
      .populate("students");

    if (!updated) {
      return res.status(404).json({ error: "Class not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating class:", error.message);
    res.status(500).json({ error: "Failed to update class" });
  }
});

// DELETE class
router.delete("/:id", async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id);
    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }

    await Class.findByIdAndDelete(req.params.id);
    res.json({ message: "Class deleted successfully" });
  } catch (error) {
    console.error("Error deleting class:", error.message);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

module.exports = router;
