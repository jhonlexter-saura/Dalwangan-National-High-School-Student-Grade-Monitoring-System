const mongoose = require("mongoose");

const gradebookSchema = new mongoose.Schema(
  {
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

    academicPeriod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
    },

    finalizedAt: {
      type: Date,
      required: true,
    },

    /*
     * Stores the User._id of whoever clicked "Finalize".
     * Kept as a raw ObjectId (no ref) so that admin and teacher
     * accounts can both finalize without coupling to one model.
     */
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One finalized record per subject assignment + period
gradebookSchema.index(
  { subjectAssignment: 1, academicPeriod: 1 },
  {
    unique: true,
    partialFilterExpression: { subjectAssignment: { $type: "objectId" } },
  }
);

// One class-wide gradebook per class and period (subjectAssignment is null).
gradebookSchema.index(
  { class: 1, academicPeriod: 1 },
  {
    unique: true,
    partialFilterExpression: { subjectAssignment: { $type: "null" } },
  }
);

module.exports = mongoose.model("Gradebook", gradebookSchema);
