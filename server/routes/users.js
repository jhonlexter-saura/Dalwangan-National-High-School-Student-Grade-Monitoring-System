const express = require("express");

const { requireAdmin } = require("../middleware/authorization");
const { requireProfileAuth } = require("../middleware/requireProfileAuth");
const { validateObjectId } = require("../middleware/validateObjectId");
const {
  accountManagementLimiter,
  dataModificationLimiter,
  searchFilterLimiter,
} = require("../middleware/rateLimits");
const {
  validateProfileBodyObject,
  validateCreateAccountBody,
  validateSelfProfileUpdate,
  validateAdminUserUpdate,
  validateTeacherStatusBody,
} = require("../middleware/validators/userValidation");
const controller = require("../controller/userController");

const router = express.Router();

const validateUserId = validateObjectId("id", "Invalid user ID");

// Admin: accounts
router.post("/", requireAdmin, accountManagementLimiter, validateCreateAccountBody, controller.createAccount);
router.get("/", requireAdmin, searchFilterLimiter, controller.getUsers);

// My own profile ("/me" must stay above "/:id")
router.get("/me", requireProfileAuth, controller.getMyProfile);
router.patch("/me", requireProfileAuth, dataModificationLimiter, validateProfileBodyObject, validateSelfProfileUpdate, controller.updateMyProfile);

// Admin: one user
router.get("/:id", requireAdmin, searchFilterLimiter, validateUserId, controller.getUser);
router.patch("/:id/status", requireAdmin, dataModificationLimiter, validateUserId, validateTeacherStatusBody, controller.updateTeacherStatus);
router.patch("/:id", requireAdmin, dataModificationLimiter, validateProfileBodyObject, validateUserId, validateAdminUserUpdate, controller.updateUser);

module.exports = router;