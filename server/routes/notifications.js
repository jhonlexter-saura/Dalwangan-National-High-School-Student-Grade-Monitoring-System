const express = require("express");
const mongoose = require("mongoose");

const Notification = require("../models/Notification");
const { requireAuthenticatedUser } = require("../middleware/authorization");

const router = express.Router();

router.use(requireAuthenticatedUser);

router.get("/me", async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.authenticatedUser._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const unreadCount = await Notification.countDocuments({
      recipient: req.authenticatedUser._id,
      readAt: null,
    });

    return res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Failed to load notifications:", error.message);
    return res.status(500).json({ error: "Failed to load notifications" });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.authenticatedUser._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return res.json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Failed to mark notifications read:", error.message);
    return res.status(500).json({ error: "Failed to update notifications" });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.authenticatedUser._id },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    return res.json(notification);
  } catch (error) {
    console.error("Failed to mark notification read:", error.message);
    return res.status(500).json({ error: "Failed to update notification" });
  }
});

module.exports = router;
