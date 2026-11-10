const mongoose = require("mongoose");

const googleIntegrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    googleEmail: {
      type: String,
      default: "",
      trim: true,
    },
    accessToken: {
      type: String,
      required: true,
      select: false,
    },
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
    expiryDate: {
      type: Number,
      default: 0,
    },
    scope: {
      type: String,
      default: "",
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GoogleIntegration", googleIntegrationSchema);
