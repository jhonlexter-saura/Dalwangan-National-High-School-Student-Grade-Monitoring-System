const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    type: {
      type: String,
      enum: ["quiz", "assignment", "exam", "project", "activity"],
      default: "activity",
    },

    totalPoints: {
      type: Number,
      required: true,
      min: 0,
    },

    date: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "locked"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Activity", activitySchema);