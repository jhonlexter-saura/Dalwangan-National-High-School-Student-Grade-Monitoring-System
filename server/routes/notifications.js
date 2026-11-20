const express = require("express");

const { requireAuthenticatedUser } = require("../middleware/authorization");
const { validateObjectId } = require("../middleware/validateObjectId");
const controller = require("../controller/notificationController");

const router = express.Router();

router.use(requireAuthenticatedUser);

router.get("/me", controller.getMyNotifications);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", validateObjectId("id", "Invalid notification ID"), controller.markRead);

module.exports = router;