const Teacher = require("../models/Teacher");

/**
 * True if the user is an admin, or the teacher who owns the given
 * subject assignment. Needs a DB lookup, so it is a helper/service
 * (not middleware). Reusable by any controller that guards
 * assignment-owned data (activities, scores, gradebooks...).
 */
async function canManageAssignment(user, assignment) {
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;

  const teacher = await Teacher.findOne({ user: user._id }).select("_id").lean();
  return Boolean(teacher) && String(assignment.teacher) === String(teacher._id);
}

module.exports = { canManageAssignment };