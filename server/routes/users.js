
const express = require("express");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

const {
  requireAdmin,
  getTokenUserId,
  isAuthenticationConfigured,
} = require("../middleware/authorization");

const router = express.Router();

const NAME_FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "nameExtension",
];

const PROFILE_FIELDS = [
  ...NAME_FIELDS,
  "birthdate",
  "contactNumber",
  "address",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function composeName(profile, fallback = "") {
  const parts = NAME_FIELDS
    .map((field) => cleanString(profile[field]))
    .filter(Boolean);

  return parts.length ? parts.join(" ") : fallback;
}

function safeUser(user) {
  const result = user.toObject();
  delete result.password;
  delete result.resetPasswordToken;
  delete result.resetPasswordExpires;
  return result;
}

function sendSafeProfile(user, extra = {}) {
  return {
    ...safeUser(user),
    ...extra,
    _id: user._id,
  };
}

// Authentication for a user's own profile.
// The account ID always comes from the verified access token.
async function requireAuth(req, res, next) {
  if (!isAuthenticationConfigured()) {
    return res.status(503).json({
      error: "Authentication is not configured correctly",
    });
  }

  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const userId = match ? getTokenUserId(match[1]) : null;

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return res.status(401).json({
      error: "A valid login is required",
    });
  }

  try {
    const user = await User.findById(userId).select(
      "name firstName middleName lastName nameExtension email role status contactNumber address birthdate"
    );

    if (!user || user.status !== "active") {
      return res.status(401).json({
        error: "Your account is unavailable or inactive",
      });
    }

    req.authenticatedUser = user;
    next();
  } catch (error) {
    console.error("Authentication verification failed:", error);
    return res.status(500).json({
      error: "Unable to verify your account",
    });
  }
}

// CREATE ACCOUNT (Admin only)
router.post("/", requireAdmin, async (req, res) => {
  let createdUser;

  try {
    const {
      name,
      email,
      password,
      role,
      studentId,
      gradeLevel,
      section,
      schoolYear,
    } = req.body || {};

    const normalizedName = cleanString(name);
    const normalizedEmail = cleanString(email).toLowerCase();

    if (
      !normalizedName ||
      !normalizedEmail ||
      typeof password !== "string" ||
      !["student", "teacher", "admin"].includes(role)
    ) {
      return res.status(400).json({
        error: "Name, email, password, and a valid role are required",
      });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        error: "Enter a valid email address",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    let studentData;

    if (role === "student") {
      const normalizedStudentId = cleanString(studentId);
      const normalizedSection = cleanString(section);
      const normalizedSchoolYear = cleanString(schoolYear);
      const normalizedGradeLevel = Number(gradeLevel);

      if (
        !normalizedStudentId ||
        !normalizedSection ||
        !normalizedSchoolYear ||
        !Number.isInteger(normalizedGradeLevel) ||
        normalizedGradeLevel < 7 ||
        normalizedGradeLevel > 12
      ) {
        return res.status(400).json({
          error:
            "Student ID, grade level (7-12), section, and school year are required",
        });
      }

      const existingStudent = await Student.findOne({
        $or: [
          { studentId: normalizedStudentId },
          { email: normalizedEmail },
        ],
      });

      if (existingStudent) {
        return res.status(409).json({
          error: "Student ID or email is already registered",
        });
      }

      studentData = {
        studentId: normalizedStudentId,
        gradeLevel: normalizedGradeLevel,
        section: normalizedSection,
        schoolYear: normalizedSchoolYear,
      };
    }

    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({
        error: "Email is already registered",
      });
    }

    createdUser = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role,
      status: "active",
    });

    if (role === "student") {
      await Student.create({
        user: createdUser._id,
        ...studentData,
        name: normalizedName,
        email: normalizedEmail,
      });
    } else if (role === "teacher") {
      await Teacher.create({
        user: createdUser._id,
        name: normalizedName,
        email: normalizedEmail,
        status: "active",
      });
    }

    return res.status(201).json({
      _id: createdUser._id,
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      status: createdUser.status,
    });
  } catch (error) {
    console.error("Create user account error:", error);

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
      return res.status(409).json({
        error: "Email, student ID, or account is already registered",
      });
    }

    return res.status(500).json({
      error: "Failed to create user account",
    });
  }
});

// GET USERS (existing endpoint)
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;

    const users = await User.find(filter)
      .select("-password -resetPasswordToken -resetPasswordExpires")
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({
      error: "Failed to fetch users",
    });
  }
});

// GET MY PROFILE
router.get("/me", requireAuth, async (req, res) => {
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
    return res.status(500).json({
      error: "Failed to load profile",
    });
  }
});

// UPDATE MY PROFILE
// Email, role, status, and password are intentionally excluded.
router.patch("/me", requireAuth, async (req, res) => {
  try {
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({
        error: "A profile update is required",
      });
    }

    const forbiddenFields = [
      "userId",
      "_id",
      "email",
      "role",
      "status",
      "password",
    ];

    if (forbiddenFields.some((field) => Object.hasOwn(req.body, field))) {
      return res.status(400).json({
        error:
          "Email, account ID, role, status, and password cannot be changed here",
      });
    }

    const allowedFields = new Set(PROFILE_FIELDS);
    const unsupportedFields = Object.keys(req.body).filter(
      (field) => !allowedFields.has(field)
    );

    if (unsupportedFields.length) {
      return res.status(400).json({
        error: `Unsupported profile field(s): ${unsupportedFields.join(", ")}`,
      });
    }

    const user = await User.findById(req.authenticatedUser._id);

    if (!user || user.status !== "active") {
      return res.status(401).json({
        error: "Your account is unavailable or inactive",
      });
    }

    for (const field of PROFILE_FIELDS) {
      if (Object.hasOwn(req.body, field)) {
        if (typeof req.body[field] !== "string") {
          return res.status(400).json({
            error: `${field} must be a string`,
          });
        }

        user[field] = req.body[field].trim();
      }
    }

    // Keep the legacy name field for older pages and existing records.
    user.name = composeName(user, user.name || "");

    await user.save();

    const nameFields = {
      name: user.name,
      firstName: user.firstName || "",
      middleName: user.middleName || "",
      lastName: user.lastName || "",
      nameExtension: user.nameExtension || "",
    };

    if (user.role === "teacher") {
      await Teacher.updateOne(
        { user: user._id },
        {
          $set: {
            ...nameFields,
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
            contactNumber: user.contactNumber || "",
            address: user.address || "",
            birthdate: user.birthdate || "",
          },
        }
      );
    }

    return res.json(sendSafeProfile(user));
  } catch (error) {
    console.error("Self profile update error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        error: "That email or account detail is already registered",
      });
    }

    return res.status(500).json({
      error: "Failed to update profile",
    });
  }
});

// GET USER BY ID (existing endpoint)
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      error: "Failed to fetch user",
    });
  }
});

// UPDATE TEACHER STATUS (Admin only)
router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const { status } = req.body || {};

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        error: "Status must be active or inactive",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "teacher") {
      return res.status(400).json({
        error: "Only teacher accounts can be changed here",
      });
    }

    user.status = status;
    await user.save();

    await Teacher.updateOne(
      { user: user._id },
      { $set: { status } }
    );

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  } catch (error) {
    console.error("Update teacher account status error:", error);
    return res.status(500).json({
      error: "Failed to update teacher account status",
    });
  }
});

// UPDATE USER BY ID (Admin only)
// Administrators may update email and profile details here.
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({
        error: "A profile update is required",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const body = req.body;

    if (Object.hasOwn(body, "email")) {
      const email = cleanString(body.email).toLowerCase();

      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({
          error: "Enter a valid email address",
        });
      }

      const duplicate = await User.exists({
        email,
        _id: { $ne: user._id },
      });

      if (duplicate) {
        return res.status(409).json({
          error: "Email is already registered",
        });
      }

      user.email = email;
    }

    for (const field of [...PROFILE_FIELDS, "name"]) {
      if (!Object.hasOwn(body, field)) continue;

      if (typeof body[field] !== "string") {
        return res.status(400).json({
          error: `${field} must be a string`,
        });
      }

      user[field] = body[field].trim();
    }

    if (NAME_FIELDS.some((field) => Object.hasOwn(body, field))) {
      user.name = composeName(user, user.name || "");
    }

    await user.save();

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
            email: user.email,
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
            email: user.email,
            contactNumber: user.contactNumber || "",
            address: user.address || "",
            birthdate: user.birthdate || "",
          },
        }
      );
    }

    return res.json(sendSafeProfile(user));
  } catch (error) {
    console.error("Update user profile error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        error: "Email or account detail is already registered",
      });
    }

    return res.status(500).json({
      error: "Failed to update user profile",
    });
  }
});

module.exports = router;