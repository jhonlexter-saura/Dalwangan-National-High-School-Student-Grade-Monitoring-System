const express = require("express");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { requireAdmin } = require("../middleware/authorization");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role;
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET user by ID
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password");

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);

    res.status(500).json({
      error: "Failed to fetch user",
    });
  }
});

// UPDATE an existing teacher or administrator profile. Role, status, and password
// are deliberately immutable through this profile-editing endpoint.
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "A profile update is required" });
    }

    if (
      Object.hasOwn(req.body, "role") ||
      Object.hasOwn(req.body, "password") ||
      Object.hasOwn(req.body, "status")
    ) {
      return res.status(400).json({
        error: "Role, status, and password cannot be changed here",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!["teacher", "admin"].includes(user.role)) {
      return res.status(400).json({
        error: "Use the student profile endpoint to edit student accounts",
      });
    }

    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : user.name;
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : user.email;

    if (!name || !email) {
      return res.status(400).json({
        error: "Name and email are required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }

    const existingUser = await User.findOne({
      email,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    user.name = name;
    user.email = email;
    await user.save();

    if (user.role === "teacher") {
      await Teacher.updateOne(
        { user: user._id },
        { $set: { name, email } }
      );
    }

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  } catch (error) {
    console.error("Update user profile error:", error);

    if (error.code === 11000) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    return res.status(500).json({
      error: "Failed to update user profile",
    });
  }
});

// CREATE USER
router.post("/", async (req, res) => {
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
    } = req.body;

    // --------------------------------
    // Basic account validation
    // --------------------------------

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: "Name, email, password, and role are required",
      });
    }

    if (!["student", "teacher", "admin"].includes(role)) {
      return res.status(400).json({
        error: "Invalid user role",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // --------------------------------
    // Check duplicate account
    // --------------------------------

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        error: "Email is already registered",
      });
    }

    // --------------------------------
    // Student-specific validation
    // --------------------------------

    if (role === "student") {
      if (
        !studentId ||
        gradeLevel === undefined ||
        !section ||
        !schoolYear
      ) {
        return res.status(400).json({
          error:
            "Student ID, grade level, section, and school year are required",
        });
      }

      const existingStudent = await Student.findOne({
        $or: [
          { studentId: studentId.trim() },
          { email: normalizedEmail },
        ],
      });

      if (existingStudent) {
        return res.status(409).json({
          error: "Student ID or email is already registered",
        });
      }
    }

    // --------------------------------
    // Hash password
    // --------------------------------

    const hashedPassword = await bcrypt.hash(password, 10);

    // --------------------------------
    // Create User
    // --------------------------------

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      status: "active",
    });

    // --------------------------------
    // Create Student profile
    // --------------------------------

    let student = null;
    let teacher = null;

    if (role === "student") {
      student = await Student.create({
        user: user._id,
        studentId: studentId.trim(),
        name: name.trim(),
        email: normalizedEmail,
        gradeLevel: Number(gradeLevel),
        section: section.trim(),
        schoolYear: schoolYear.trim(),
        status: "active",
      });
    }

    if (role === "teacher") {
      teacher = await Teacher.create({
        user: user._id,
        name: name.trim(),
        email: normalizedEmail,
        status: "active",
      });
    }

    // --------------------------------
    // Safe response
    // --------------------------------

    const safeUser = user.toObject();

    delete safeUser.password;

    res.status(201).json({
      user: safeUser,
      student,
      teacher,
    });
  } catch (error) {
    console.error("Create user error:", error);

    res.status(500).json({
      error: "Failed to create user",
    });
  }
});

module.exports = router;