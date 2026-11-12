const mongoose = require("mongoose");

const gradebookLockSchema = new mongoose.Schema(
  {
    resourceKey: { type: String, required: true, unique: true },
    ownerToken: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GradebookLock", gradebookLockSchema);
