const mongoose = require("mongoose");

const integrationSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "global",
      unique: true,
      required: true,
    },
    googleSignIn: {
      type: Boolean,
      default: true,
    },
    recaptcha: {
      type: Boolean,
      default: true,
    },
    emailMailer: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "IntegrationSetting",
  integrationSettingSchema
);
