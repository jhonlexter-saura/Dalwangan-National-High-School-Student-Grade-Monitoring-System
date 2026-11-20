const express = require("express");

const { requireAdmin } = require("../middleware/authorization");
const { validateObjectId } = require("../middleware/validateObjectId");
const {
  validateStudentStatusBody,
  validateProfileUpdateShape,
  validateCreateStudentBody,
  validateStudentIdsBody,
  validateEnrollmentIds,
} = require("../middleware/validators/studentValidation");
const controller = require("../controller/studentController");

const router = express.Router();

const validateStudentId = validateObjectId("id", "Invalid student ID");

// Reads
router.get("/", controller.getStudents);
router.get("/:id", controller.getStudent);

// Student records
router.patch("/:id/status", requireAdmin, validateStudentId, validateStudentStatusBody, controller.updateStudentStatus);
router.patch("/:id", requireAdmin, validateProfileUpdateShape, validateStudentId, controller.updateStudentProfile);
router.post("/", validateCreateStudentBody, controller.createStudent);

// Class enrollment.
// The "/batch/..." routes MUST stay above "/:studentId/classes/:classId",
// otherwise "batch" would be treated as a student ID.
router.post("/batch/classes/:classId/teacher/:userId", validateStudentIdsBody, controller.batchAddToClassByTeacher);
router.post("/batch/classes/:classId", validateStudentIdsBody, controller.batchAddToClass);
router.post("/:studentId/classes/:classId", controller.addStudentToClass);
router.post("/:studentId/classes/:classId/teacher/:userId", controller.teacherAddStudentToClass);
router.delete("/:studentId/classes/:classId", requireAdmin, validateEnrollmentIds, controller.removeStudentFromClass);

module.exports = router;