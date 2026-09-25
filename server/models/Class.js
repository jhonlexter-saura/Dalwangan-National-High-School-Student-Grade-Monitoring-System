const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    section: {
      type: String,
      required: true,
      trim: true,
    },

    gradeLevel: {
      type: Number,
      required: true,
    },

    adviser: {
      type: String,
      required: true,
      trim: true,
    },

    schoolYear: {
      type: String,
      required: true,
      trim: true,
    },

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Class", classSchema);