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

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
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

    gradingSystem: {
      enabled: {
        type: Boolean,
        default: false,
      },

      components: [
        {
          key: {
            type: String,
            enum: [
              "written_work",
              "performance_task",
              "assessment",
            ],
            required: true,
          },

          name: {
            type: String,
            required: true,
            trim: true,
          },

          percentage: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
          },
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Class", classSchema);