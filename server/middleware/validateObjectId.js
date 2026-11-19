const mongoose = require("mongoose");

/**
 * Reusable middleware factory: checks that req.params[paramName]
 * is a valid MongoDB ObjectId before the controller runs.
 *
 * Usage: router.patch("/:id", validateObjectId("id", "Invalid academic period ID"), ctrl.update)
 */
function validateObjectId(paramName = "id", message = "Invalid ID") {
  return (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[paramName])) {
      return res.status(400).json({ error: message });
    }
    next();
  };
}

module.exports = { validateObjectId };