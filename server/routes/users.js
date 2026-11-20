const express = require("express");

const { requireAdmin } = require("../middleware/authorization");
const { requireProfileAuth } = require("../middleware/requireProfileAuth");
const { validateObjectId } = require("../middleware/validateObjectId");
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
router.post("/", requireAdmin, validateCreateAccountBody, controller.createAccount);
router.get("/", requireAdmin, controller.getUsers);

// My own profile ("/me" must stay above "/:id")
router.get("/me", requireProfileAuth, controller.getMyProfile);
router.patch("/me", requireProfileAuth, validateProfileBodyObject, validateSelfProfileUpdate, controller.updateMyProfile);

// Admin: one user
router.get("/:id", requireAdmin, validateUserId, controller.getUser);
router.patch("/:id/status", requireAdmin, validateUserId, validateTeacherStatusBody, controller.updateTeacherStatus);
router.patch("/:id", requireAdmin, validateProfileBodyObject, validateUserId, validateAdminUserUpdate, controller.updateUser);

module.exports = router;