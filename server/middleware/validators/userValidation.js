const {
  NAME_FIELDS,
  PROFILE_FIELDS,
  EMAIL_REGEX,
  cleanString,
} = require("../../utils/userProfile");

/* ---------- shared helper ---------- */

// Checks each listed field that was sent: must be a string, and contactNumber must be
// 11 digits. Returns { updates } (trimmed values) or { error }. Used by both profile routes.
function readProfileFields(body, fields) {
  const updates = {};

  for (const field of fields) {
    if (!Object.hasOwn(body, field)) continue;

    if (typeof body[field] !== "string") {
      return { error: `${field} must be a string` };
    }

    if (field === "contactNumber" && body[field].trim()) {
      if (!/^\d{11}$/.test(body[field].trim())) {
        return { error: "Contact number must be strictly 11 digits" };
      }
    }

    updates[field] = body[field].trim();
  }

  return { updates };
}

/* ---------- middleware ---------- */

/** PATCH /me and PATCH /:id: the body must be a plain object. */
function validateProfileBodyObject(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "A profile update is required" });
  }
  next();
}

/** POST / -> req.accountData = { name, email, password, role, studentData? } */
function validateCreateAccountBody(req, res, next) {
  const { name, email, password, role, studentId, gradeLevel, section, schoolYear } =
    req.body || {};

  const normalizedName = cleanString(name);
  const normalizedEmail = cleanString(email).toLowerCase();

  if (
    !normalizedName ||
    !normalizedEmail ||
    typeof password !== "string" ||
    !["student", "teacher", "admin"].includes(role)
  ) {
    return res.status(400).json({
      error: "Name, email, password, and a valid role are required",
    });
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  let studentData;

  if (role === "student") {
    const normalizedStudentId = cleanString(studentId);
    const hasGradeLevel = gradeLevel !== undefined && gradeLevel !== null && gradeLevel !== "";
    const normalizedGradeLevel = hasGradeLevel ? Number(gradeLevel) : null;

    if (
      !normalizedStudentId ||
      (hasGradeLevel &&
        (!Number.isInteger(normalizedGradeLevel) ||
          normalizedGradeLevel < 7 ||
          normalizedGradeLevel > 12))
    ) {
      return res.status(400).json({
        error:
          "A student LRN is required. If grade level is provided, it must be between 7 and 12.",
      });
    }

    studentData = {
      studentId: normalizedStudentId,
      gradeLevel: normalizedGradeLevel,
      section: cleanString(section) || "",
      schoolYear: cleanString(schoolYear) || "",
    };
  }

  req.accountData = {
    name: normalizedName,
    email: normalizedEmail,
    password,
    role,
    studentData,
  };
  next();
}

/** PATCH /me -> req.profileUpdates (own profile; email/role/status/password are off limits) */
function validateSelfProfileUpdate(req, res, next) {
  const body = req.body;

  const forbiddenFields = ["userId", "_id", "email", "role", "status", "password"];
  if (forbiddenFields.some((field) => Object.hasOwn(body, field))) {
    return res.status(400).json({
      error: "Email, account ID, role, status, and password cannot be changed here",
    });
  }

  const allowedFields = new Set(PROFILE_FIELDS);
  if (req.authenticatedUser.role === "student") {
    allowedFields.add("name");
  }

  const unsupportedFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unsupportedFields.length) {
    return res.status(400).json({
      error: `Unsupported profile field(s): ${unsupportedFields.join(", ")}`,
    });
  }

  const result = readProfileFields(body, allowedFields);
  if (result.error) return res.status(400).json({ error: result.error });

  req.profileUpdates = result.updates;
  next();
}

/** PATCH /:id (admin) -> req.userUpdates = { email?, fields, touchesName } */
function validateAdminUserUpdate(req, res, next) {
  const body = req.body;
  let email;

  if (Object.hasOwn(body, "email")) {
    email = cleanString(body.email).toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
  }

  const result = readProfileFields(body, [...PROFILE_FIELDS, "name"]);
  if (result.error) return res.status(400).json({ error: result.error });

  req.userUpdates = {
    email,
    fields: result.updates,
    touchesName: NAME_FIELDS.some((field) => Object.hasOwn(body, field)),
  };
  next();
}

/** PATCH /:id/status -> req.accountStatus */
function validateTeacherStatusBody(req, res, next) {
  const { status } = req.body || {};
  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({ error: "Status must be active or inactive" });
  }
  req.accountStatus = status;
  next();
}

module.exports = {
  validateProfileBodyObject,
  validateCreateAccountBody,
  validateSelfProfileUpdate,
  validateAdminUserUpdate,
  validateTeacherStatusBody,
};