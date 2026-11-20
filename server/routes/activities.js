const express = require("express");

const { requireAuthenticatedUser } = require("../middleware/authorization");
const { lockGradebookForActivity } = require("../middleware/gradebookLock");
const {
  dataModificationLimiter,
  searchFilterLimiter,
} = require("../middleware/rateLimits");
const {
  validateCreateActivity,
  validateUpdateActivity,
} = require("../middleware/validators/activityValidation");
const controller = require("../controller/activityController");

const router = express.Router();

// Reads (order matters: specific paths before "/:id")
router.get("/", searchFilterLimiter, controller.getActivities);
router.get("/class/:classId", searchFilterLimiter, controller.getClassActivities);
router.get("/assignment/:assignmentId", requireAuthenticatedUser, searchFilterLimiter, controller.getAssignmentActivities);
router.get("/class/:classId/period/:academicPeriodId", searchFilterLimiter, controller.getClassPeriodActivities);
router.get("/:id", searchFilterLimiter, controller.getActivity);

// Writes
router.post("/", requireAuthenticatedUser, dataModificationLimiter, lockGradebookForActivity, validateCreateActivity, controller.createActivity);
router.put("/:id", requireAuthenticatedUser, dataModificationLimiter, validateUpdateActivity, controller.updateActivity);
router.delete("/:id", requireAuthenticatedUser, dataModificationLimiter, controller.deleteActivity);

module.exports = router;