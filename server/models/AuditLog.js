const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "grades",
        "classes",
        "activities",
        "students",
        "accounts",
        "calendar",
        "system",
      ],
      index: true,
    },

    actor: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      name: {
        type: String,
        default: "System",
      },
      email: {
        type: String,
        default: "",
      },
      role: {
        type: String,
        enum: ["admin", "teacher", "student", "system"],
        default: "system",
      },
    },

    target: {
      entityType: {
        type: String,
        default: "",
      },
      entityId: {
        type: String,
        default: "",
      },
      name: {
        type: String,
        default: "",
      },
    },

    description: {
      type: String,
      required: true,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
      default: "",
    },

    userAgent: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["success", "failed", "warning"],
      default: "success",
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({
  description: "text",
  "actor.name": "text",
  "actor.email": "text",
  "target.name": "text",
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
