const Notification = require("../models/Notification");

async function getMyNotifications(req, res) {
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
}

async function markAllRead(req, res) {
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
}

// :id already validated by validateObjectId middleware
async function markRead(req, res) {
  try {
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
}

module.exports = { getMyNotifications, markAllRead, markRead };