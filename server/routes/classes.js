const express = require("express");

const {
  validateTeacherClassBody,
  validateClassBody,
  validateClassUpdateBody,
} = require("../middleware/validators/classValidation");
const controller = require("../controller/classController");

const router = express.Router();

// Reads (specific paths before "/:id")
router.get("/", controller.getClasses);
router.get("/teacher/:userId", controller.getTeacherClasses);
router.get("/:id", controller.getClass);

// Writes
router.post("/teacher/:userId", validateTeacherClassBody, controller.createTeacherClass);
router.post("/", validateClassBody, controller.createClass);
router.put("/:id", validateClassUpdateBody, controller.updateClass);
router.delete("/:id", controller.deleteClass);

module.exports = router;