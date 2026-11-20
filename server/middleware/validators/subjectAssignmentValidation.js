const mongoose = require("mongoose");

const isText = (value) => typeof value === "string" && value.trim() !== "";

// Subject grading must have exactly 3 components totaling 100%. Returns null if invalid.
function normalizeGradingSystem(input) {
  if (!input?.enabled) return { enabled: false, components: [] };
  const components = Array.isArray(input.components) ? input.components : [];
  const total = components.reduce(
    (sum, component) => sum + Number(component?.percentage || 0),
    0
  );
  if (components.length !== 3 || total !== 100) return null;
  return { enabled: true, components };
}

/** POST / -> req.assignmentData */
function validateCreateAssignmentBody(req, res, next) {
  const { classId, subject, teacherUserId, gradingSystem } = req.body || {};

  if (
    !mongoose.isValidObjectId(classId) ||
    !mongoose.isValidObjectId(teacherUserId) ||
    !isText(subject)
  ) {
    return res.status(400).json({ error: "Class, subject, and teacher are required" });
  }

  const normalizedGradingSystem = normalizeGradingSystem(gradingSystem);
  if (!normalizedGradingSystem) {
    return res.status(400).json({ error: "Subject grading percentages must total 100%" });
  }

  req.assignmentData = {
    classId,
    subject: subject.trim(),
    teacherUserId,
    gradingSystem: normalizedGradingSystem,
  };
  next();
}

/** PATCH /:id -> req.assignmentUpdates (only the fields that were sent) */
function validateUpdateAssignmentBody(req, res, next) {
  const { subject, teacherUserId, gradingSystem, active } = req.body || {};
  const updates = {};

  if (subject !== undefined) {
    if (!isText(subject)) return res.status(400).json({ error: "Subject is required" });
    updates.subject = subject.trim();
  }
  if (teacherUserId !== undefined) updates.teacherUserId = teacherUserId;
  if (gradingSystem !== undefined) {
    const normalized = normalizeGradingSystem(gradingSystem);
    if (!normalized) {
      return res.status(400).json({ error: "Subject grading percentages must total 100%" });
    }
    updates.gradingSystem = normalized;
  }
  if (active !== undefined) updates.active = Boolean(active);

  req.assignmentUpdates = updates;
  next();
}

module.exports = { normalizeGradingSystem, validateCreateAssignmentBody, validateUpdateAssignmentBody };