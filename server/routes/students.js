const express = require("express");
const mongoose = require("mongoose");
const Student = require("../models/Student");
const Class = require("../models/Class");
const User = require("../models/User");
const { requireAdmin } = require("../middleware/authorization");

const router = express.Router();

// GET all students
router.get("/", async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });

    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error.message);
    res.status(500).json({
      error: "Failed to fetch students",
    });
  }
});

// GET one student
router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    res.json(student);
  } catch (error) {
    console.error("Error fetching student:", error.message);
    res.status(500).json({
      error: "Failed to fetch student",
    });
  }
});

// UPDATE a student profile and synchronize its linked login account, if present.
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "A profile update is required" });
    }

    if (
      Object.hasOwn(req.body, "role") ||
      Object.hasOwn(req.body, "password") ||
      Object.hasOwn(req.body, "status") ||
      Object.hasOwn(req.body, "user")
    ) {
      return res.status(400).json({
        error: "Role, status, password, and account links cannot be changed here",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const studentId =
      typeof req.body.studentId === "string"
        ? req.body.studentId.trim()
        : student.studentId;
    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : student.name;
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : student.email;
    const section =
      typeof req.body.section === "string"
        ? req.body.section.trim()
        : student.section;
    const schoolYear =
      typeof req.body.schoolYear === "string"
        ? req.body.schoolYear.trim()
        : student.schoolYear;
    const gradeLevel =
      req.body.gradeLevel === undefined
        ? student.gradeLevel
        : Number(req.body.gradeLevel);

    if (!studentId || !name || !email || !section || !schoolYear) {
      return res.status(400).json({
        error: "Student ID, name, email, grade level, section, and school year are required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }

    if (!Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
      return res.status(400).json({
        error: "Grade level must be between 7 and 12",
      });
    }

    const [duplicateStudent, duplicateAccount] = await Promise.all([
      Student.findOne({
        $or: [{ studentId }, { email }],
        _id: { $ne: student._id },
      }),
      User.findOne({
        email,
        ...(student.user ? { _id: { $ne: student.user } } : {}),
      }),
    ]);

    if (duplicateStudent) {
      return res.status(409).json({
        error: "Student ID or email is already registered",
      });
    }

    if (duplicateAccount) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    student.studentId = studentId;
    student.name = name;
    student.email = email;
    student.gradeLevel = gradeLevel;
    student.section = section;
    student.schoolYear = schoolYear;
    await student.save();

    if (student.user) {
      await User.updateOne(
        { _id: student.user, role: "student" },
        { $set: { name, email } }
      );
    }

    return res.json(student);
  } catch (error) {
    console.error("Update student profile error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        error: "Student ID or email is already registered",
      });
    }

    return res.status(500).json({
      error: "Failed to update student profile",
    });
  }
});

// CREATE student
router.post("/", async (req, res) => {
  try {
    const {
      studentId,
      name,
      email,
      gradeLevel,
      section,
      schoolYear,
    } = req.body;

    if (
      !studentId ||
      !name ||
      !email ||
      !gradeLevel ||
      !section ||
      !schoolYear
    ) {
      return res.status(400).json({
        error: "All student fields are required",
      });
    }

    const existingStudent = await Student.findOne({
      $or: [{ studentId }, { email }],
    });

    if (existingStudent) {
      return res.status(409).json({
        error: "Student ID or email already exists",
      });
    }

    const student = await Student.create({
      studentId,
      name,
      email,
      gradeLevel,
      section,
      schoolYear,
    });

    res.status(201).json(student);
  } catch (error) {
    console.error("Error creating student:", error.message);
    res.status(500).json({
      error: "Failed to create student",
    });
  }
});

// ADD STUDENT TO CLASS
router.post("/:studentId/classes/:classId", async (req, res) => {
  try {
    const { studentId, classId } = req.params;

    const student = await Student.findById(studentId);
    const classData = await Class.findById(classId);

    if (!student) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    if (!classData) {
      return res.status(404).json({
        error: "Class not found",
      });
    }

    const alreadyEnrolled = classData.students.some(
      (id) => id.toString() === student._id.toString()
    );

    if (alreadyEnrolled) {
      return res.status(409).json({
        error: "Student is already enrolled in this class",
      });
    }

    classData.students.push(student._id);

    await classData.save();

    const updatedClass = await Class.findById(classId).populate("students");

    res.json({
      message: "Student added to class successfully",
      class: updatedClass,
    });
  } catch (error) {
    console.error("Error adding student to class:", error.message);
    res.status(500).json({
      error: "Failed to add student to class",
    });
  }
});


// TEACHER: ADD STUDENT TO OWN CLASS
router.post(
  "/:studentId/classes/:classId/teacher/:userId",
  async (req, res) => {
    try {
      const { studentId, classId, userId } = req.params;

      const Teacher = require("../models/Teacher");

      const teacher = await Teacher.findOne({
        user: userId,
      });

      if (!teacher) {
        return res.status(404).json({
          error: "Teacher profile not found",
        });
      }

      const student = await Student.findById(studentId);

      if (!student) {
        return res.status(404).json({
          error: "Student not found",
        });
      }

      const classData = await Class.findById(classId);

      if (!classData) {
        return res.status(404).json({
          error: "Class not found",
        });
      }

      // Make sure this class belongs to the teacher
      if (
        classData.teacher.toString() !==
        teacher._id.toString()
      ) {
        return res.status(403).json({
          error: "You do not have permission to modify this class",
        });
      }

      // Prevent duplicate enrollment
      const alreadyEnrolled = classData.students.some(
        (id) => id.toString() === student._id.toString()
      );

      if (alreadyEnrolled) {
        return res.status(409).json({
          error: "Student is already enrolled in this class",
        });
      }

      classData.students.push(student._id);

      await classData.save();

      const updatedClass = await Class.findById(classId)
        .populate("teacher")
        .populate("students");

      res.json({
        message: "Student added to class successfully",
        class: updatedClass,
      });
    } catch (error) {
      console.error(
        "Teacher add student error:",
        error.message
      );

      res.status(500).json({
        error: "Failed to add student to class",
      });
    }
  }
);

module.exports = router;