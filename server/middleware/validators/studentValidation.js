const mongoose = require("mongoose");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PATCH /:id/status */
function validateStudentStatusBody(req, res, next) {
  const { status } = req.body || {};
  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({ error: "Status must be active or inactive" });
  }
  req.studentStatus = status;
  next();
}

/**
 * PATCH /:id (step 1): structure only. Normalizes the fields that were sent into
 * req.profileUpdates; fields that were not sent stay undefined.
 */
function validateProfileUpdateShape(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "A profile update is required" });
  }

  if (["role", "password", "status", "user"].some((field) => Object.hasOwn(body, field))) {
    return res.status(400).json({
      error: "Role, status, password, and account links cannot be changed here",
    });
  }

  req.profileUpdates = {
    studentId: typeof body.studentId === "string" ? body.studentId.trim() : undefined,
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined,
    section: typeof body.section === "string" ? body.section.trim() : undefined,
    schoolYear: typeof body.schoolYear === "string" ? body.schoolYear.trim() : undefined,
    gradeLevel: body.gradeLevel === undefined ? undefined : Number(body.gradeLevel),
  };
  next();
}

/**
 * PATCH /:id (step 2): pure validator for the FINAL merged profile
 * (existing student values + the update). It has to run in the controller because
 * it needs the stored student, e.g. an older record with an empty section.
 * Returns an error message, or null if valid.
 */
function validateStudentProfile(profile) {
  const { studentId, name, email, gradeLevel, section, schoolYear } = profile;

  if (!studentId || !name || !email || !section || !schoolYear) {
    return "Student ID, name, email, grade level, section, and school year are required";
  }
  if (!EMAIL_REGEX.test(email)) {
    return "Enter a valid email address";
  }
  if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
    return "Grade level must be between 7 and 12";
  }
  return null;
}

/** POST / -> req.studentData */
function validateCreateStudentBody(req, res, next) {
  const { studentId, name, email, gradeLevel, section, schoolYear } = req.body || {};

  if (!studentId || !name || !email || !gradeLevel || !section || !schoolYear) {
    return res.status(400).json({ error: "All student fields are required" });
  }

  req.studentData = { studentId, name, email, gradeLevel, section, schoolYear };
  next();
}

/** POST /batch/... -> req.studentIds */
function validateStudentIdsBody(req, res, next) {
  const { studentIds } = req.body || {};
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: "studentIds array is required" });
  }
  req.studentIds = studentIds;
  next();
}

/** DELETE /:studentId/classes/:classId */
function validateEnrollmentIds(req, res, next) {
  const { studentId, classId } = req.params;
  if (!mongoose.isValidObjectId(studentId) || !mongoose.isValidObjectId(classId)) {
    return res.status(400).json({ error: "Invalid student or class ID" });
  }
  next();
}

module.exports = {
  validateStudentStatusBody,
  validateProfileUpdateShape,
  validateStudentProfile,
  validateCreateStudentBody,
  validateStudentIdsBody,
  validateEnrollmentIds,
};