const express = require("express");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { requireAdmin } = require("../middleware/authorization");

const router = express.Router();

// Custom authorization middleware using req.headers / session
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// UPDATE MY PROFILE (Self-service for logged-in user)
router.patch("/me", requireAuth, async (req, res) => {
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

    // Resolve userId from body, query parameter, or header
    const targetUserId =
      req.body.userId || req.query.userId || req.headers["x-user-id"];

    if (!targetUserId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ error: "Invalid User ID format" });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { name, email, contactNumber, address, birthdate } = req.body;

    const updatedName = typeof name === "string" ? name.trim() : user.name;
    const updatedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : user.email;
    const updatedContact =
      typeof contactNumber === "string"
        ? contactNumber.trim()
        : user.contactNumber || "";
    const updatedAddress =
      typeof address === "string" ? address.trim() : user.address || "";
    const updatedBirthdate =
      typeof birthdate === "string" ? birthdate.trim() : user.birthdate || "";

    user.name = updatedName;
    user.email = updatedEmail;
    user.contactNumber = updatedContact;
    user.address = updatedAddress;
    user.birthdate = updatedBirthdate;
    await user.save();

    let studentData = null;

    if (user.role === "teacher") {
      await Teacher.updateOne(
        { user: user._id },
        {
          $set: {
            name: updatedName,
            email: updatedEmail,
            contactNumber: updatedContact,
            address: updatedAddress,
          },
        }
      );
    }

    if (user.role === "student") {
      studentData = await Student.findOneAndUpdate(
        { user: user._id },
        {
          $set: {
            name: updatedName,
            email: updatedEmail,
            contactNumber: updatedContact,
            address: updatedAddress,
            birthdate: updatedBirthdate,
          },
        },
        { new: true }
      );
    }

    const safeUser = user.toObject();
    delete safeUser.password;

    // Return merged profile data so student details (studentId, section, gradeLevel) are retained
    return res.json({
      ...safeUser,
      ...(studentData ? studentData.toObject() : {}),
      _id: safeUser._id, // Ensure user ID takes precedence
    });
  } catch (error) {
    console.error("Self profile update error:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET user by ID
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// UPDATE user by ID (Admin Only)
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "A profile update is required" });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : user.name;
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : user.email;
    const contactNumber =
      typeof req.body.contactNumber === "string"
        ? req.body.contactNumber.trim()
        : user.contactNumber || "";
    const address =
      typeof req.body.address === "string"
        ? req.body.address.trim()
        : user.address || "";
    const birthdate =
      typeof req.body.birthdate === "string"
        ? req.body.birthdate.trim()
        : user.birthdate || "";

    user.name = name;
    user.email = email;
    user.contactNumber = contactNumber;
    user.address = address;
    user.birthdate = birthdate;
    await user.save();

    if (user.role === "teacher") {
      await Teacher.updateOne(
        { user: user._id },
        { $set: { name, email, contactNumber, address } }
      );
    }

    if (user.role === "student") {
      await Student.updateOne(
        { user: user._id },
        { $set: { name, email, contactNumber, address, birthdate } }
      );
    }

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      contactNumber: user.contactNumber,
      address: user.address,
      birthdate: user.birthdate,
      role: user.role,
      status: user.status,
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    return res.status(500).json({ error: "Failed to update user profile" });
  }
});

module.exports = router;