const mongoose = require("mongoose");

const subjectAssignmentSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    gradingSystem: {
      enabled: { type: Boolean, default: true },
      components: [
        {
          key: {
            type: String,
            enum: ["written_work", "performance_task", "assessment"],
            required: true,
          },
          name: { type: String, required: true, trim: true },
          percentage: { type: Number, min: 0, max: 100, required: true },
        },
      ],
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

subjectAssignmentSchema.index({ class: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model("SubjectAssignment", subjectAssignmentSchema);
