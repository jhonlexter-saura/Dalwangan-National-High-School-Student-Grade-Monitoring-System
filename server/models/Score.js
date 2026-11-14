const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    subjectAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubjectAssignment",
      default: null,
      index: true,
    },

    activity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Activity",
      required: true,
    },

    score: {
      type: Number,
      required: true,
      min: 0,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

scoreSchema.index(
  {
    student: 1,
    activity: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model("Score", scoreSchema);
