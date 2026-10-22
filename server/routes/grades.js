const express = require("express");

const { calculateClassGrades } = require("../services/grades");

const router = express.Router();

router.get("/class/:classId", async (req, res) => {
  try {
    const results = await calculateClassGrades(req.params.classId);

    return res.json(results);
  } catch (error) {
    console.error("Error calculating class grades:", error.message);

    if (error.message === "Class not found") {
      return res.status(404).json({
        error: "Class not found",
      });
    }

    return res.status(500).json({
      error: "Failed to calculate class grades",
    });
  }
});

router.get("/class/:classId/student/:studentId", async (req, res) => {
  try {
    const [result] = await calculateClassGrades(
      req.params.classId,
      req.params.studentId
    );

    if (!result) {
      return res.status(404).json({
        error: "Student grade not found",
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Error calculating student grade:", error.message);

    if (error.message === "Class not found") {
      return res.status(404).json({
        error: "Class not found",
      });
    }

    return res.status(500).json({
      error: "Failed to calculate student grade",
    });
  }
});

module.exports = router;
