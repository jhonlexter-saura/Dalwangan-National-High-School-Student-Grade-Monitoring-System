const express = require("express");
const Student = require("../models/Student");
const Class = require("../models/Class");

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