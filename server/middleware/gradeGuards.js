const mongoose = require("mongoose");
const { getTokenUserId } = require("./authorization");

/**
 * Reusable factory: allows only the listed roles (run after requireAuthenticatedUser).
 * Usage: requireRoles(["admin", "teacher"], "Teacher or administrator access is required")
 */
function requireRoles(roles, message) {
  return (req, res, next) => {
    if (!roles.includes(req.authenticatedUser?.role)) {
      return res.status(403).json({ error: message });
    }
    next();
  };
}

/**
 * Best-effort bearer token check used by the "student/me" routes.
 * Stores the user ID on req.bearerUserId, or returns 401.
 * (Unlike requireAuthenticatedUser, it does not load the user.)
 */
function requireBearerUserId(req, res, next) {
  const auth = req.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const userId = match ? getTokenUserId(match[1]) : null;

  if (!userId) {
    return res.status(401).json({ error: "A valid login is required" });
  }
  req.bearerUserId = userId;
  next();
}

// Factory: every named route param must be a valid ObjectId.
function validateParamIds(names, message) {
  return (req, res, next) => {
    if (!names.every((name) => mongoose.isValidObjectId(req.params[name]))) {
      return res.status(400).json({ error: message });
    }
    next();
  };
}

const validateAssignmentPeriodIds = validateParamIds(
  ["assignmentId", "periodId"],
  "Invalid subject assignment or period ID"
);
const validateClassPeriodIds = validateParamIds(
  ["classId", "periodId"],
  "Invalid class or period ID"
);

module.exports = {
  requireRoles,
  requireBearerUserId,
  validateAssignmentPeriodIds,
  validateClassPeriodIds,
};