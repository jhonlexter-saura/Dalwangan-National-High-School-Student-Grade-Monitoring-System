const express = require("express");

const { requireAuthenticatedUser } = require("../middleware/authorization");
const { lockGradebookForActivity } = require("../middleware/gradebookLock");
const {
  validateCreateActivity,
  validateUpdateActivity,
} = require("../middleware/validators/activityValidation");
const controller = require("../controller/activityController");

const router = express.Router();

// Reads (order matters: specific paths before "/:id")
router.get("/", controller.getActivities);
router.get("/class/:classId", controller.getClassActivities);
router.get("/assignment/:assignmentId", requireAuthenticatedUser, controller.getAssignmentActivities);
router.get("/class/:classId/period/:academicPeriodId", controller.getClassPeriodActivities);
router.get("/:id", controller.getActivity);

// Writes
router.post("/", requireAuthenticatedUser, lockGradebookForActivity, validateCreateActivity, controller.createActivity);
router.put("/:id", requireAuthenticatedUser, validateUpdateActivity, controller.updateActivity);
router.delete("/:id", requireAuthenticatedUser, controller.deleteActivity);

module.exports = router;