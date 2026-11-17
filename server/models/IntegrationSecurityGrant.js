const mongoose = require("mongoose");

const integrationSecurityGrantSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    superUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    superUserEmail: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["access-otp", "access-session", "change-approval"],
      required: true,
      index: true,
    },
    codeHash: {
      type: String,
      select: false,
    },
    codeExpiresAt: {
      type: Date,
    },
    accessTokenHash: {
      type: String,
      select: false,
    },
    action: {
      type: String,
    },
    payloadHash: {
      type: String,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("IntegrationSecurityGrant", integrationSecurityGrantSchema);
