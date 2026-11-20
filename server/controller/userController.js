const bcrypt = require("bcrypt");

const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { logAudit } = require("../services/auditLogger");
const { safeUser } = require("../utils/safeUser");
const { composeName } = require("../utils/userProfile");

/* ---------- helpers (used only by this controller) ---------- */

function sendSafeProfile(user, extra = {}) {
  return {
    ...safeUser(user),
    ...extra,
    _id: user._id,
  };
}

// Copies profile changes to the linked Teacher/Student record.
// The self-update route does not touch email; the admin route does.
async function syncLinkedProfile(user, { includeEmail }) {
  const email = includeEmail ? { email: user.email } : {};

  if (user.role === "teacher") {
    await Teacher.updateOne(
      { user: user._id },
      {
        $set: {
          name: user.name,
          firstName: user.firstName || "",
          middleName: user.middleName || "",
          lastName: user.lastName || "",
          nameExtension: user.nameExtension || "",
          ...email,
          birthdate: user.birthdate || "",
          contactNumber: user.contactNumber || "",
          address: user.address || "",
        },
      }
    );
  }

  if (user.role === "student") {
    await Student.updateOne(
      { user: user._id },
      {
        $set: {
          name: user.name,
          ...email,
          contactNumber: user.contactNumber || "",
          address: user.address || "",
          birthdate: user.birthdate || "",
        },
      }
    );
  }
}

// Same audit entry was written by both profile-update routes.
function logAccountUpdated(req, user) {
  logAudit({
    req,
    action: "ACCOUNT_UPDATED",
    category: "accounts",
    target: { entityType: "User", entityId: String(user._id), name: user.name },
    description: `Updated profile for '${user.name}' (${user.role}, ${user.email})`,
    details: { name: user.name, email: user.email, role: user.role },
  });
}

/* ---------- handlers ---------- */

// POST / (admin; body validated by middleware)
async function createAccount(req, res) {
  let createdUser;

  try {
    const { name, email, password, role, studentData } = req.accountData;

    if (studentData) {
      const existingStudent = await Student.findOne({
        $or: [{ studentId: studentData.studentId }, { email }],
      });

      if (existingStudent) {
        return res.status(409).json({ error: "Student ID or email is already registered" });
      }
    }

    if (await User.exists({ email })) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    createdUser = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role,
      status: "active",
    });

    if (role === "student") {
      await Student.create({
        user: createdUser._id,
        ...studentData,
        name,
        email,
      });
    } else if (role === "teacher") {
      await Teacher.create({
        user: createdUser._id,
        name,
        email,
        status: "active",
      });
    }

    logAudit({
      req,
      action: "ACCOUNT_CREATED",
      category: "accounts",
      target: { entityType: "User", entityId: String(createdUser._id), name: createdUser.name },
      description: `Created ${createdUser.role} account for '${createdUser.name}' (${createdUser.email})`,
      details: { name: createdUser.name, email: createdUser.email, role: createdUser.role },
    });

    return res.status(201).json({
      _id: createdUser._id,
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      status: createdUser.status,
    });
  } catch (error) {
    console.error("Create user account error:", error);

    // Roll back a half-created account.
    if (createdUser) {
      await Promise.all([
        User.deleteOne({ _id: createdUser._id }),
        Student.deleteOne({ user: createdUser._id }),
        Teacher.deleteOne({ user: createdUser._id }),
      ]).catch((cleanupError) => {
        console.error("Failed to clean up incomplete account:", cleanupError);
      });
    }

    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "Email, student ID, or account is already registered" });
    }

    return res.status(500).json({ error: "Failed to create user account" });
  }
}

// GET / (admin)
async function getUsers(req, res) {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;

    const users = await User.find(filter)
      .select("-password -resetPasswordToken -resetPasswordExpires")
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
}

// GET /me
async function getMyProfile(req, res) {
  try {
    const user = await User.findById(req.authenticatedUser._id).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Backfill display fields for legacy accounts that only have `name`.
    const profile = user.toObject();
    if (!profile.firstName && !profile.middleName && !profile.lastName) {
      profile.legacyName = profile.name || "";
    }

    return res.json(profile);
  } catch (error) {
    console.error("Get my profile error:", error);
    return res.status(500).json({ error: "Failed to load profile" });
  }
}

// PATCH /me (fields validated by middleware)
// Email, role, status, and password are intentionally excluded.
async function updateMyProfile(req, res) {
  try {
    const user = await User.findById(req.authenticatedUser._id);

    if (!user || user.status !== "active") {
      return res.status(401).json({ error: "Your account is unavailable or inactive" });
    }

    for (const [field, value] of Object.entries(req.profileUpdates)) {
      user[field] = value;
    }

    // Keep the legacy name field for older pages and existing records.
    user.name = composeName(user, user.name || "");

    await user.save();
    await syncLinkedProfile(user, { includeEmail: false });
    logAccountUpdated(req, user);

    return res.json(sendSafeProfile(user));
  } catch (error) {
    console.error("Self profile update error:", error);

    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "That email or account detail is already registered" });
    }

    return res.status(500).json({ error: "Failed to update profile" });
  }
}

// GET /:id (admin; ID validated by middleware)
async function getUser(req, res) {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
}

// PATCH /:id/status (admin; ID + status validated by middleware)
async function updateTeacherStatus(req, res) {
  try {
    const status = req.accountStatus;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "teacher") {
      return res.status(400).json({ error: "Only teacher accounts can be changed here" });
    }

    user.status = status;
    await user.save();

    await Teacher.updateOne({ user: user._id }, { $set: { status } });

    logAudit({
      req,
      action: "ACCOUNT_STATUS_CHANGED",
      category: "accounts",
      target: { entityType: "User", entityId: String(user._id), name: user.name },
      description: `Updated account status for '${user.name}' (${user.role}) to '${status}'`,
      details: { name: user.name, email: user.email, role: user.role, newStatus: status },
    });

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  } catch (error) {
    console.error("Update teacher account status error:", error);
    return res.status(500).json({ error: "Failed to update teacher account status" });
  }
}

// PATCH /:id (admin; ID, email format and fields validated by middleware)
// Administrators may update email and profile details here.
async function updateUser(req, res) {
  try {
    const { email, fields, touchesName } = req.userUpdates;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (email !== undefined) {
      const duplicate = await User.exists({ email, _id: { $ne: user._id } });

      if (duplicate) {
        return res.status(409).json({ error: "Email is already registered" });
      }

      user.email = email;
    }

    for (const [field, value] of Object.entries(fields)) {
      user[field] = value;
    }

    if (touchesName) {
      user.name = composeName(user, user.name || "");
    }

    await user.save();
    await syncLinkedProfile(user, { includeEmail: true });
    logAccountUpdated(req, user);

    return res.json(sendSafeProfile(user));
  } catch (error) {
    console.error("Update user profile error:", error);

    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "Email or account detail is already registered" });
    }

    return res.status(500).json({ error: "Failed to update user profile" });
  }
}

module.exports = {
  createAccount,
  getUsers,
  getMyProfile,
  updateMyProfile,
  getUser,
  updateTeacherStatus,
  updateUser,
};