const express = require("express");

const { requireAdmin } = require("../middleware/authorization");
const { validateObjectId } = require("../middleware/validateObjectId");
const {
  accountManagementLimiter,
  dataModificationLimiter,
  searchFilterLimiter,
} = require("../middleware/rateLimits");
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
router.get("/", searchFilterLimiter, controller.getStudents);
router.get("/:id", searchFilterLimiter, controller.getStudent);

// Student records
router.patch("/:id/status", requireAdmin, dataModificationLimiter, validateStudentId, validateStudentStatusBody, controller.updateStudentStatus);
router.patch("/:id", requireAdmin, dataModificationLimiter, validateProfileUpdateShape, validateStudentId, controller.updateStudentProfile);
router.post("/", accountManagementLimiter, validateCreateStudentBody, controller.createStudent);

// Class enrollment.
// The "/batch/..." routes MUST stay above "/:studentId/classes/:classId",
// otherwise "batch" would be treated as a student ID.
router.post("/batch/classes/:classId/teacher/:userId", dataModificationLimiter, validateStudentIdsBody, controller.batchAddToClassByTeacher);
router.post("/batch/classes/:classId", dataModificationLimiter, validateStudentIdsBody, controller.batchAddToClass);
router.post("/:studentId/classes/:classId", dataModificationLimiter, controller.addStudentToClass);
router.post("/:studentId/classes/:classId/teacher/:userId", dataModificationLimiter, controller.teacherAddStudentToClass);
router.delete("/:studentId/classes/:classId", requireAdmin, dataModificationLimiter, validateEnrollmentIds, controller.removeStudentFromClass);

module.exports = router;