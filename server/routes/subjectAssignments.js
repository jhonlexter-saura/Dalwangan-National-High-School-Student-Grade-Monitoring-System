const express = require("express");

const { requireAdmin, requireAuthenticatedUser } = require("../middleware/authorization");
const { validateObjectId } = require("../middleware/validateObjectId");
const { requireSelfOrAdmin } = require("../middleware/requireSelfOrAdmin");
const {
  validateCreateAssignmentBody,
  validateUpdateAssignmentBody,
} = require("../middleware/validators/subjectAssignmentValidation");
const controller = require("../controller/subjectAssignmentController");

const router = express.Router();

const validateAssignmentId = validateObjectId("id", "Invalid subject assignment ID");

router.get("/", requireAdmin, controller.getAssignments);
router.get(
  "/teacher/:userId",
  requireAuthenticatedUser,
  requireSelfOrAdmin("userId", "You can only view your own subject assignments"),
  controller.getTeacherAssignments
);
router.get("/class/:classId", requireAdmin, controller.getClassAssignments);
router.post("/", requireAdmin, validateCreateAssignmentBody, controller.createAssignment);
router.patch("/:id", requireAdmin, validateAssignmentId, validateUpdateAssignmentBody, controller.updateAssignment);
router.delete("/:id", requireAdmin, validateAssignmentId, controller.deleteAssignment);

module.exports = router;