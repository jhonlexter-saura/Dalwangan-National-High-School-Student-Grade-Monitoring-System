const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const { logAudit } = require("../services/auditLogger");

/* ---------- helpers (used only by this controller) ---------- */

const classLabel = (c) => `${c.name} · Section ${c.section}`;

// Both create routes did the same create + populate + audit; only the adviser differed.
async function createClassRecord(req, data, teacherProfile) {
  const newClass = await Class.create({
    name: data.name,
    section: data.section,
    gradeLevel: data.gradeLevel,
    teacher: teacherProfile?._id || null,
    schoolYear: data.schoolYear,
    students: [],
    gradingSystem: data.gradingSystem,
  });

  const populatedClass = await Class.findById(newClass._id)
    .populate("teacher")
    .populate("students");

  logAudit({
    req,
    action: "CLASS_CREATED",
    category: "classes",
    target: {
      entityType: "Class",
      entityId: String(newClass._id),
      name: classLabel(newClass),
    },
    description: `Created class '${newClass.name}' (Section: ${newClass.section}, Grade ${newClass.gradeLevel}, S.Y.: ${newClass.schoolYear})`,
    details: {
      name: newClass.name,
      section: newClass.section,
      gradeLevel: newClass.gradeLevel,
      schoolYear: newClass.schoolYear,
      adviser: teacherProfile?.name || "Unassigned",
    },
  });

  return populatedClass;
}

/* ---------- handlers ---------- */

async function getClasses(req, res) {
  try {
    const classes = await Class.find().populate("students").sort({ createdAt: -1 });
    res.json(classes);
  } catch (error) {
    console.error("Error fetching classes:", error.message);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
}

async function getTeacherClasses(req, res) {
  try {
    const teacher = await Teacher.findOne({ user: req.params.userId });
    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    const classes = await Class.find({ teacher: teacher._id })
      .populate("teacher")
      .populate("students")
      .sort({ createdAt: -1 });

    res.json(classes);
  } catch (error) {
    console.error("Get teacher classes error:", error);
    res.status(500).json({ error: "Failed to fetch teacher classes" });
  }
}

async function createTeacherClass(req, res) {
  try {
    const teacher = await Teacher.findOne({ user: req.params.userId });
    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    const populatedClass = await createClassRecord(req, req.classData, teacher);
    res.status(201).json(populatedClass);
  } catch (error) {
    console.error("Create teacher class error:", error);
    res.status(500).json({ error: "Failed to create class" });
  }
}

async function getClass(req, res) {
  try {
    const classData = await Class.findById(req.params.id).populate("students");
    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }
    res.json(classData);
  } catch (error) {
    console.error("Error fetching class:", error.message);
    res.status(500).json({ error: "Failed to fetch class" });
  }
}

async function createClass(req, res) {
  try {
    const { teacherUserId } = req.classData;

    const teacherProfile = teacherUserId
      ? await Teacher.findOne({ user: teacherUserId })
      : null;

    if (teacherUserId && !teacherProfile) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    const populatedClass = await createClassRecord(req, req.classData, teacherProfile);
    res.status(201).json(populatedClass);
  } catch (error) {
    console.error("Error creating class:", error.message);
    res.status(500).json({ error: "Failed to create class" });
  }
}

async function updateClass(req, res) {
  try {
    const updateData = req.classUpdates;

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

    logAudit({
      req,
      action: "CLASS_UPDATED",
      category: "classes",
      target: {
        entityType: "Class",
        entityId: String(updated._id),
        name: classLabel(updated),
      },
      description: `Updated class details for '${updated.name}' (Section: ${updated.section})`,
      details: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating class:", error.message);
    res.status(500).json({ error: "Failed to update class" });
  }
}

async function deleteClass(req, res) {
  try {
    const classData = await Class.findById(req.params.id);
    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }

    await Class.findByIdAndDelete(req.params.id);

    logAudit({
      req,
      action: "CLASS_DELETED",
      category: "classes",
      target: {
        entityType: "Class",
        entityId: String(classData._id),
        name: classLabel(classData),
      },
      description: `Deleted class '${classData.name}' (Section: ${classData.section}, Grade ${classData.gradeLevel})`,
      details: {
        name: classData.name,
        section: classData.section,
        gradeLevel: classData.gradeLevel,
      },
    });

    res.json({ message: "Class deleted successfully" });
  } catch (error) {
    console.error("Error deleting class:", error.message);
    res.status(500).json({ error: "Failed to delete class" });
  }
}

module.exports = {
  getClasses,
  getTeacherClasses,
  createTeacherClass,
  getClass,
  createClass,
  updateClass,
  deleteClass,
};