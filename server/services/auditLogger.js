const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { getTokenUserId } = require("../middleware/authorization");

async function resolveActor(req, overrideActor = null) {
  if (overrideActor) return overrideActor;

  try {
    if (req?.authenticatedUser) {
      let name = req.authenticatedUser.name;
      let email = req.authenticatedUser.email;
      let role = req.authenticatedUser.role;

      if (!name || !email) {
        const fullUser = await User.findById(req.authenticatedUser._id)
          .select("name email role")
          .lean();
        if (fullUser) {
          name = fullUser.name || name;
          email = fullUser.email || email;
          role = fullUser.role || role;
        }
      }

      return {
        user: req.authenticatedUser._id,
        name: name || "User",
        email: email || "",
        role: role || "system",
      };
    }

    if (req) {
      const auth = req.get("authorization") || "";
      const match = auth.match(/^Bearer\s+(.+)$/i);
      if (match) {
        const userId = getTokenUserId(match[1]);
        if (userId) {
          const user = await User.findById(userId)
            .select("name email role")
            .lean();
          if (user) {
            return {
              user: user._id,
              name: user.name || "User",
              email: user.email || "",
              role: user.role || "system",
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("resolveActor error:", err.message);
  }

  return {
    user: null,
    name: "System",
    email: "",
    role: "system",
  };
}

async function logAudit({
  req,
  actor: customActor,
  action,
  category,
  target = {},
  description,
  details = {},
  status = "success",
}) {
  try {
    const actor = await resolveActor(req, customActor);
    const ipAddress =
      req?.headers?.["x-forwarded-for"] ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      "";
    const userAgent = req?.headers?.["user-agent"] || "";

    const logEntry = await AuditLog.create({
      action,
      category,
      actor,
      target,
      description,
      details,
      ipAddress: String(ipAddress),
      userAgent: String(userAgent),
      status,
    });

    return logEntry;
  } catch (error) {
    // Non-blocking: Audit logging errors should never break main operations
    console.error("Audit log error:", error.message);
    return null;
  }
}

/**
 * Backfill initial audit entries from existing records if audit logs are completely empty
 */
async function backfillAuditLogsIfEmpty() {
  try {
    const count = await AuditLog.countDocuments();
    if (count > 0) return;

    const Class = require("../models/Class");
    const Activity = require("../models/Activity");
    const Gradebook = require("../models/Gradebook");

    const [classes, activities, gradebooks, users] = await Promise.all([
      Class.find().populate("teacher").limit(50).lean(),
      Activity.find().populate("class").populate("academicPeriod").limit(50).lean(),
      Gradebook.find().populate("subjectAssignment").populate("academicPeriod").populate("finalizedBy").limit(50).lean(),
      User.find().select("name email role createdAt").limit(50).lean(),
    ]);

    const initialLogs = [];

    // Backfill user accounts
    for (const u of users) {
      initialLogs.push({
        action: "ACCOUNT_CREATED",
        category: "accounts",
        actor: { user: null, name: "Historical record · actor unknown", email: "", role: "system" },
        target: { entityType: "User", entityId: String(u._id), name: u.name || "User" },
        description: `Historical record: ${u.role || "user"} account for '${u.name || "User"}' (${u.email || ""}); original actor is unknown`,
        details: { role: u.role, email: u.email, historicalBackfill: true, actorKnown: false },
        createdAt: u.createdAt || new Date(),
      });
    }

    // Backfill classes
    for (const c of classes) {
      initialLogs.push({
        action: "CLASS_CREATED",
        category: "classes",
        actor: { user: null, name: "Historical record · actor unknown", email: "", role: "system" },
        target: { entityType: "Class", entityId: String(c._id), name: `${c.name} · Section ${c.section}` },
        description: `Historical record: class '${c.name}' (Section: ${c.section}, Grade: ${c.gradeLevel}, S.Y.: ${c.schoolYear}); original actor is unknown`,
        details: { name: c.name, section: c.section, gradeLevel: c.gradeLevel, schoolYear: c.schoolYear, historicalBackfill: true, actorKnown: false },
        createdAt: c.createdAt || new Date(),
      });
    }

    // Backfill activities
    for (const a of activities) {
      initialLogs.push({
        action: "ACTIVITY_CREATED",
        category: "activities",
        actor: { user: null, name: "Historical record · actor unknown", email: "", role: "system" },
        target: { entityType: "Activity", entityId: String(a._id), name: a.title },
        description: `Historical record: activity '${a.title}' (${a.type || "activity"}, ${a.totalPoints || 0} pts) for ${a.class?.name || "Class"}; original actor is unknown`,
        details: { title: a.title, type: a.type, totalPoints: a.totalPoints, date: a.date, historicalBackfill: true, actorKnown: false },
        createdAt: a.createdAt || new Date(),
      });
    }

    // Backfill gradebook finalizations
    for (const g of gradebooks) {
      initialLogs.push({
        action: "GRADEBOOK_FINALIZED",
        category: "grades",
        actor: { user: g.finalizedBy?._id || null, name: g.finalizedBy?.name || "Faculty Teacher", email: g.finalizedBy?.email || "", role: g.finalizedBy?.role || "teacher" },
        target: { entityType: "Gradebook", entityId: String(g._id), name: `Gradebook (${g.academicPeriod?.name || "Term"})` },
        description: `Finalized subject gradebook for ${g.academicPeriod?.name || "Academic Period"}`,
        details: { periodName: g.academicPeriod?.name, finalizedAt: g.finalizedAt },
        createdAt: g.finalizedAt || g.createdAt || new Date(),
      });
    }

    if (initialLogs.length > 0) {
      await AuditLog.insertMany(initialLogs);
      console.log(`Initialized ${initialLogs.length} audit trail records.`);
    }
  } catch (error) {
    console.error("Failed to backfill initial audit logs:", error.message);
  }
}

module.exports = {
  logAudit,
  resolveActor,
  backfillAuditLogsIfEmpty,
};
