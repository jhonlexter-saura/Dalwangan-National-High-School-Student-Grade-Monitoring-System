/**
 * Factory (run after requireAuthenticatedUser): admins always pass; anyone else
 * may only act on their own user ID, taken from the named route param.
 *
 * Usage: router.get("/teacher/:userId", requireAuthenticatedUser,
 *          requireSelfOrAdmin("userId", "You can only view your own ..."), ctrl.list)
 */
function requireSelfOrAdmin(paramName, message) {
  return (req, res, next) => {
    const user = req.authenticatedUser;
    if (user.role !== "admin" && String(user._id) !== String(req.params[paramName])) {
      return res.status(403).json({ error: message });
    }
    next();
  };
}

module.exports = { requireSelfOrAdmin };