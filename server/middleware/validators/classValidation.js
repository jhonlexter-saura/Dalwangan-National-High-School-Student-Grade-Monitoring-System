const isText = (value) => typeof value === "string" && value.trim() !== "";

// Pure helper (unchanged logic): returns null when percentages don't total 100.
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

// Shared by both create routes. Returns cleaned fields, or null if something is missing.
function readClassFields(body) {
  const { name, section, gradeLevel, schoolYear } = body || {};
  if (!isText(name) || !isText(section) || gradeLevel === undefined || !isText(schoolYear)) {
    return null;
  }
  return {
    name: name.trim(),
    section: section.trim(),
    gradeLevel: Number(gradeLevel),
    schoolYear: schoolYear.trim(),
  };
}

/** POST /teacher/:userId -> req.classData */
function validateTeacherClassBody(req, res, next) {
  const fields = readClassFields(req.body);
  if (!fields) {
    return res.status(400).json({
      error: "Name, section, grade level, and school year are required",
    });
  }

  const gradingSystem = normalizeGradingSystem(req.body.gradingSystem);
  if (!gradingSystem) {
    return res.status(400).json({ error: "Grading percentages must total 100%" });
  }

  req.classData = { ...fields, gradingSystem };
  next();
}

/** POST / -> req.classData (includes optional teacherUserId) */
function validateClassBody(req, res, next) {
  const fields = readClassFields(req.body);
  if (!fields) {
    return res.status(400).json({
      error: "Class name, section, grade level, and school year are required",
    });
  }

  const teacherId = req.body.teacher;
  if (teacherId && !/^[a-f\d]{24}$/i.test(String(teacherId))) {
    return res.status(400).json({ error: "Invalid teacher" });
  }

  const gradingSystem = normalizeGradingSystem(req.body.gradingSystem);
  if (!gradingSystem) {
    return res.status(400).json({ error: "Grading percentages must total 100%" });
  }

  req.classData = { ...fields, gradingSystem, teacherUserId: teacherId || null };
  next();
}

/** PUT /:id -> req.classUpdates (only the fields that were sent) */
function validateClassUpdateBody(req, res, next) {
  const { name, section, gradeLevel, schoolYear } = req.body || {};
  const updates = {};

  for (const [key, value] of Object.entries({ name, section, schoolYear })) {
    if (!value) continue;
    if (typeof value !== "string") {
      return res
        .status(400)
        .json({ error: "Name, section, and school year must be text" });
    }
    updates[key] = value.trim();
  }
  if (gradeLevel !== undefined) updates.gradeLevel = Number(gradeLevel);

  req.classUpdates = updates;
  next();
}

module.exports = {
  normalizeGradingSystem,
  validateTeacherClassBody,
  validateClassBody,
  validateClassUpdateBody,
};