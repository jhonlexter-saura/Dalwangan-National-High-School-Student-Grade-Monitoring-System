const express = require("express");

const {
  dataModificationLimiter,
  searchFilterLimiter,
} = require("../middleware/rateLimits");
const {
  validateTeacherClassBody,
  validateClassBody,
  validateClassUpdateBody,
} = require("../middleware/validators/classValidation");
const controller = require("../controller/classController");

const router = express.Router();

// Reads (specific paths before "/:id")
router.get("/", searchFilterLimiter, controller.getClasses);
router.get("/teacher/:userId", searchFilterLimiter, controller.getTeacherClasses);
router.get("/:id", searchFilterLimiter, controller.getClass);

// Writes
router.post("/teacher/:userId", dataModificationLimiter, validateTeacherClassBody, controller.createTeacherClass);
router.post("/", dataModificationLimiter, validateClassBody, controller.createClass);
router.put("/:id", dataModificationLimiter, validateClassUpdateBody, controller.updateClass);
router.delete("/:id", dataModificationLimiter, controller.deleteClass);

module.exports = router;