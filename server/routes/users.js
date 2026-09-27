const express = require("express");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

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