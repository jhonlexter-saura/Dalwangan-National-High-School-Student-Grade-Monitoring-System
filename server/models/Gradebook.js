const mongoose = require("mongoose");

const gradebookSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
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

// One finalized record per class + period
gradebookSchema.index(
  { class: 1, academicPeriod: 1 },
  { unique: true }
);

module.exports = mongoose.model("Gradebook", gradebookSchema);
