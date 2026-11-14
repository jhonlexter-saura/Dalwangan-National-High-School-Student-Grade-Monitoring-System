const mongoose = require("mongoose");

const academicPeriodSchema = new mongoose.Schema(
  {
    schoolYear: {
      type: String,
      required: true,
      trim: true,
    },

    trimester: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["upcoming", "active", "completed"],
      default: "upcoming",
    },
  },
  {
    timestamps: true,
  }
);

academicPeriodSchema.index(
  { schoolYear: 1, trimester: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "AcademicPeriod",
  academicPeriodSchema
);