const express = require("express");
const mongoose = require("mongoose");

const SubjectAssignment = require("../models/SubjectAssignment");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const { requireAdmin, requireAuthenticatedUser } = require("../middleware/authorization");

const router = express.Router();

function normalizeGradingSystem(input) {
  if (!input?.enabled) return { enabled: false, components: [] };
  const components = Array.isArray(input.components) ? input.components : [];
  const total = components.reduce((sum, component) => sum + Number(component.percentage || 0), 0);
  if (components.length !== 3 || total !== 100) return null;
  return { enabled: true, components };
}

function populateAssignment(query) {
  return query
    .populate({ path: "class", populate: { path: "students" } })
    .populate("teacher", "name email user")
    .sort({ createdAt: -1 });
}

router.get("/", requireAdmin, async (req, res) => {
  try {
    const assignments = await populateAssignment(SubjectAssignment.find({ active: true }));
    return res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch subject assignments:", error.message);
    return res.status(500).json({ error: "Failed to fetch subject assignments" });
  }
});

router.get("/teacher/:userId", requireAuthenticatedUser, async (req, res) => {
  try {
    if (req.authenticatedUser.role !== "admin" && String(req.authenticatedUser._id) !== String(req.params.userId)) {
      return res.status(403).json({ error: "You can only view your own subject assignments" });
    }
    const teacher = await Teacher.findOne({ user: req.params.userId }).select("_id");
    if (!teacher) return res.json([]);
    const assignments = await populateAssignment(
      SubjectAssignment.find({ teacher: teacher._id, active: true })
    );
    return res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch teacher subject assignments:", error.message);
    return res.status(500).json({ error: "Failed to fetch teacher assignments" });
  }
});

router.get("/class/:classId", requireAdmin, async (req, res) => {
  try {
    const assignments = await populateAssignment(
      SubjectAssignment.find({ class: req.params.classId, active: true })
    );
    return res.json(assignments);
  } catch (error) {
    console.error("Failed to fetch class subject assignments:", error.message);
    return res.status(500).json({ error: "Failed to fetch class assignments" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { classId, subject, teacherUserId, gradingSystem } = req.body || {};
    if (!mongoose.isValidObjectId(classId) || !mongoose.isValidObjectId(teacherUserId) || !subject?.trim()) {
      return res.status(400).json({ error: "Class, subject, and teacher are required" });
    }

    const [classRecord, teacher] = await Promise.all([
      Class.findById(classId),
      Teacher.findOne({ user: teacherUserId }),
    ]);
    if (!classRecord) return res.status(404).json({ error: "Class not found" });
    if (!teacher) return res.status(404).json({ error: "Teacher profile not found" });

    const normalizedGradingSystem = normalizeGradingSystem(gradingSystem);
    if (!normalizedGradingSystem) {
      return res.status(400).json({ error: "Subject grading percentages must total 100%" });
    }

    const assignment = await SubjectAssignment.create({
      class: classRecord._id,
      subject: subject.trim(),
      teacher: teacher._id,
      gradingSystem: normalizedGradingSystem,
    });
    const populated = await populateAssignment(SubjectAssignment.findById(assignment._id));
    return res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "This subject is already assigned to the class" });
    }
    console.error("Failed to create subject assignment:", error.message);
    return res.status(500).json({ error: "Failed to create subject assignment" });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid subject assignment ID" });
    }
    const assignment = await SubjectAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Subject assignment not found" });

    const { subject, teacherUserId, gradingSystem, active } = req.body || {};
    if (subject !== undefined) {
      if (!subject.trim()) return res.status(400).json({ error: "Subject is required" });
      assignment.subject = subject.trim();
    }
    if (teacherUserId !== undefined) {
      const teacher = await Teacher.findOne({ user: teacherUserId });
      if (!teacher) return res.status(404).json({ error: "Teacher profile not found" });
      assignment.teacher = teacher._id;
    }
    if (gradingSystem !== undefined) {
      const normalized = normalizeGradingSystem(gradingSystem);
      if (!normalized) return res.status(400).json({ error: "Subject grading percentages must total 100%" });
      assignment.gradingSystem = normalized;
    }
    if (active !== undefined) assignment.active = Boolean(active);
    await assignment.save();
    const populated = await populateAssignment(SubjectAssignment.findById(assignment._id));
    return res.json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "This subject is already assigned to the class" });
    }
    console.error("Failed to update subject assignment:", error.message);
    return res.status(500).json({ error: "Failed to update subject assignment" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid subject assignment ID" });
    }
    const assignment = await SubjectAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: "Subject assignment not found" });
    }
    await SubjectAssignment.findByIdAndDelete(req.params.id);
    return res.json({ message: "Subject assignment removed successfully" });
  } catch (error) {
    console.error("Failed to delete subject assignment:", error.message);
    return res.status(500).json({ error: "Failed to delete subject assignment" });
  }
});

module.exports = router;
