const {
  calculateClassGrades,
  isGradebookComplete,
  calculateAssignmentGrades,
  isAssignmentGradebookComplete,
  calculateStudentGradeFromActivities,
} = require("../services/grades");
const Gradebook = require("../models/Gradebook");
const Class = require("../models/Class");
const Student = require("../models/Student");
const AcademicPeriod = require("../models/AcademicPeriod");
const SubjectAssignment = require("../models/SubjectAssignment");
const Activity = require("../models/Activity");
const Score = require("../models/Score");

// GET /student/me/class/:classId/period/:periodId  (req.bearerUserId set by middleware)
// Only resolves data if the gradebook is finalized AND complete.
async function getMyClassPeriodGrade(req, res) {
  try {
    const { classId, periodId } = req.params;
    const userId = req.bearerUserId;

    // Look up the Student profile for this user
    const student = await Student.findOne({ user: userId }).lean();
    if (!student) {
      return res.status(404).json({ error: "Student profile not found" });
    }

    // Gradebook must be finalized
    const gradebook = await Gradebook.findOne({
      class: classId,
      academicPeriod: periodId,
      subjectAssignment: null,
    }).lean();

    if (!gradebook) {
      return res.json({ available: false, reason: "not_finalized" });
    }

    // Completeness check (defensive – should always pass if finalized)
    const completeness = await isGradebookComplete(classId, periodId);
    if (!completeness.complete) {
      return res.json({
        available: false,
        reason: "incomplete",
        missingCategories: completeness.missingCategories,
      });
    }

    // Calculate grade
    const [gradeSummary] = await calculateClassGrades(classId, String(student._id), periodId);

    if (!gradeSummary) {
      return res.status(404).json({ error: "Grade not found" });
    }

    return res.json({
      available: true,
      studentId: String(student._id),
      finalizedAt: gradebook.finalizedAt,
      ...gradeSummary,
    });
  } catch (error) {
    console.error("Error fetching student grade:", error.message);
    return res.status(500).json({ error: "Failed to fetch student grade" });
  }
}

// GET /student/me/dashboard  (student role checked by middleware)
// Own coursework progress and published updates.
async function getMyDashboard(req, res) {
  try {
    const student = await Student.findOne({ user: req.authenticatedUser._id }).lean();
    if (!student) return res.status(404).json({ error: "Student profile not found" });

    const classes = await Class.find({ students: student._id }).lean();
    if (!classes.length) {
      return res.json({ subjects: [], recentUpdates: [], currentAverage: null, recentUpdatesCount: 0 });
    }

    const assignments = await SubjectAssignment.find({
      class: { $in: classes.map((classRecord) => classRecord._id) },
      active: true,
    })
      .populate("class")
      .populate("teacher", "name")
      .lean();

    if (!assignments.length) {
      return res.json({ subjects: [], recentUpdates: [], currentAverage: null, recentUpdatesCount: 0 });
    }

    const assignmentIds = assignments.map((assignment) => assignment._id);
    const activities = await Activity.find({ subjectAssignment: { $in: assignmentIds } })
      .populate("academicPeriod", "name trimester schoolYear status")
      .lean();
    const activityIds = activities.map((activity) => activity._id);
    const [scores, gradebooks] = await Promise.all([
      activityIds.length
        ? Score.find({ student: student._id, activity: { $in: activityIds } }).lean()
        : [],
      Gradebook.find({ subjectAssignment: { $in: assignmentIds } })
        .populate("academicPeriod")
        .lean(),
    ]);

    const scoreByActivity = new Map(scores.map((score) => [String(score.activity), score]));
    const activityById = new Map(activities.map((activity) => [String(activity._id), activity]));
    const gradebooksByAssignment = new Map();
    for (const gradebook of gradebooks) {
      const key = String(gradebook.subjectAssignment);
      gradebooksByAssignment.set(key, [...(gradebooksByAssignment.get(key) || []), gradebook]);
    }

    const subjects = await Promise.all(
      assignments.map(async (assignment) => {
        const assignmentActivities = activities.filter(
          (activity) => String(activity.subjectAssignment) === String(assignment._id)
        );
        const assignmentGradebooks = gradebooksByAssignment.get(String(assignment._id)) || [];
        const periods = (
          await Promise.all(
            assignmentGradebooks.map(async (gradebook) => {
              if (!gradebook.academicPeriod) return null;
              const completeness = await isAssignmentGradebookComplete(
                String(assignment._id),
                String(gradebook.academicPeriod._id)
              );
              if (!completeness.complete) return null;
              const [grade] = await calculateAssignmentGrades(
                String(assignment._id),
                String(student._id),
                String(gradebook.academicPeriod._id)
              );
              return grade
                ? {
                    academicPeriod: gradebook.academicPeriod,
                    finalizedAt: gradebook.finalizedAt,
                    grade,
                  }
                : null;
            })
          )
        )
          .filter(Boolean)
          .sort((a, b) => new Date(b.finalizedAt || 0) - new Date(a.finalizedAt || 0));

        const completedActivities = assignmentActivities.filter((activity) =>
          scoreByActivity.has(String(activity._id))
        ).length;
        const hasActivePeriodActivities = assignmentActivities.some(
          (activity) => activity.academicPeriod?.status === "active"
        );
        return {
          subjectAssignment: assignment,
          subject: assignment.subject,
          class: assignment.class,
          teacher: assignment.teacher,
          periods,
          totalActivities: assignmentActivities.length,
          completedActivities,
          gradeStatus: periods.length
            ? "published"
            : hasActivePeriodActivities
              ? "awaiting_finalization"
              : "not_published",
        };
      })
    );

    const finalizedPeriodMap = new Map(
      gradebooks.map((gradebook) => [
        `${gradebook.subjectAssignment}:${gradebook.academicPeriod?._id || gradebook.academicPeriod}`,
        gradebook.finalizedAt,
      ])
    );
    const recentUpdates = scores
      .map((score) => {
        const activity = activityById.get(String(score.activity));
        if (!activity) return null;
        const publishedAt = finalizedPeriodMap.get(
          `${activity.subjectAssignment}:${activity.academicPeriod?._id || activity.academicPeriod}`
        );
        if (!publishedAt) return null;
        const assignment = assignments.find(
          (item) => String(item._id) === String(activity.subjectAssignment)
        );
        return {
          _id: score._id,
          subjectAssignmentId: activity.subjectAssignment,
          subject: assignment?.subject || "Subject",
          className: assignment?.class?.name || "Class",
          title: activity.title,
          score: score.score,
          totalPoints: activity.totalPoints,
          feedback: score.remarks || "",
          updatedAt: publishedAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    const publishedGrades = subjects
      .map((subject) => subject.periods[0]?.grade?.finalGrade)
      .filter((grade) => grade !== null && grade !== undefined && Number.isFinite(Number(grade)));
    const currentAverage = publishedGrades.length
      ? Number(
          (publishedGrades.reduce((sum, grade) => sum + Number(grade), 0) / publishedGrades.length).toFixed(1)
        )
      : null;
    const now = new Date();
    const recentUpdatesCount = recentUpdates.filter(
      (item) => new Date(item.updatedAt) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    return res.json({
      subjects,
      recentUpdates: recentUpdates.slice(0, 6),
      currentAverage,
      recentUpdatesCount,
    });
  } catch (error) {
    console.error("Error fetching student dashboard:", error.message);
    return res.status(500).json({ error: "Failed to load student dashboard" });
  }
}

// GET /student/me  (req.bearerUserId set by middleware)
// The student's finalized and in-progress grades across classes.
async function getMyGrades(req, res) {
  try {
    const student = await Student.findOne({ user: req.bearerUserId }).lean();
    if (!student) {
      return res.status(404).json({ error: "Student profile not found" });
    }

    // Find all classes this student is enrolled in
    const classes = await Class.find({ students: student._id })
      .populate("teacher", "name")
      .lean();

    if (classes.length === 0) {
      return res.json([]);
    }

    const assignments = await SubjectAssignment.find({
      class: { $in: classes.map((classRecord) => classRecord._id) },
      active: true,
    })
      .populate("class")
      .populate("teacher", "name")
      .lean();

    const results = await Promise.all(
      assignments.map(async (assignment) => {
        const [gradebooks, academicPeriods, activities, scores] = await Promise.all([
          Gradebook.find({ subjectAssignment: assignment._id }).lean(),
          AcademicPeriod.find({ schoolYear: assignment.class.schoolYear })
            .sort({ trimester: 1 })
            .lean(),
          Activity.find({ subjectAssignment: assignment._id }).lean(),
          Score.find({ student: student._id, subjectAssignment: assignment._id }).lean(),
        ]);
        const scoreByActivity = new Map(scores.map((score) => [String(score.activity), score]));
        const periods = await Promise.all(
          academicPeriods.map(async (academicPeriod) => {
            const periodActivities = activities.filter(
              (activity) => String(activity.academicPeriod) === String(academicPeriod._id)
            );
            if (!periodActivities.length && academicPeriod.status !== "active") return null;
            const gradebook = gradebooks.find(
              (item) => String(item.academicPeriod) === String(academicPeriod._id)
            );
            const isFinalized = Boolean(gradebook?.finalizedAt);
            let grade;
            if (isFinalized) {
              const [gradeSummary] = await calculateAssignmentGrades(
                String(assignment._id),
                String(student._id),
                String(academicPeriod._id)
              );
              grade = gradeSummary || null;
            } else {
              const gradedActivities = periodActivities.filter((activity) =>
                scoreByActivity.has(String(activity._id))
              );
              if (gradedActivities.length) {
                grade = calculateStudentGradeFromActivities({
                  classRecord: assignment.class,
                  gradingSystem: assignment.gradingSystem,
                  activities: gradedActivities,
                  scoresByActivityId: scoreByActivity,
                });
              }
            }
            return {
              academicPeriod,
              finalizedAt: gradebook?.finalizedAt || null,
              isFinalized,
              grade,
              activities: periodActivities
                .filter((activity) => scoreByActivity.has(String(activity._id)))
                .map((activity) => ({
                  _id: activity._id,
                  title: activity.title,
                  gradingCategory: activity.gradingCategory,
                  score: scoreByActivity.get(String(activity._id)).score,
                  totalPoints: activity.totalPoints,
                  remarks: scoreByActivity.get(String(activity._id)).remarks || "",
                })),
            };
          })
        );
        return {
          class: assignment.class,
          subjectAssignment: assignment,
          subject: assignment.subject,
          teacher: assignment.teacher,
          periods: periods.filter(Boolean),
        };
      })
    );

    return res.json(results);
  } catch (error) {
    console.error("Error fetching student grades:", error.message);
    return res.status(500).json({ error: "Failed to fetch student grades" });
  }
}

module.exports = { getMyClassPeriodGrade, getMyDashboard, getMyGrades };