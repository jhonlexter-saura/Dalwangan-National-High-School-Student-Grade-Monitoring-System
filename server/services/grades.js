const Activity = require("../models/Activity");
const Class = require("../models/Class");
const Score = require("../models/Score");

const CATEGORY_KEYS = [
  "written_work",
  "performance_task",
  "assessment",
];

function getCategoryWeights(gradingSystem = {}) {
  if (!gradingSystem?.enabled) {
    return {};
  }

  return (gradingSystem.components || []).reduce(
    (accumulator, component) => {
      if (!component?.key) {
        return accumulator;
      }

      accumulator[component.key] = Number(component.percentage || 0);
      return accumulator;
    },
    {}
  );
}

function buildCategorySummary(categoryWeights) {
  return CATEGORY_KEYS.reduce((accumulator, categoryKey) => {
    const weight = Number(categoryWeights[categoryKey] || 0);

    accumulator[categoryKey] = {
      weight,
      earned: 0,
      total: 0,
      percentage: 0,
      weightedContribution: 0,
    };

    return accumulator;
  }, {});
}

function calculateStudentGradeFromActivities({
  classRecord,
  activities,
  scoresByActivityId,
}) {
  const categoryWeights = getCategoryWeights(classRecord?.gradingSystem);
  const categorySummary = buildCategorySummary(categoryWeights);

  activities.forEach((activity) => {
    const category = activity?.gradingCategory;

    if (!category || !categorySummary[category]) {
      return;
    }

    const scoreRecord = scoresByActivityId.get(String(activity._id));
    const earned = Number(scoreRecord?.score || 0);
    const total = Number(activity.totalPoints || 0);

    categorySummary[category].earned += earned;
    categorySummary[category].total += total;
  });

  Object.entries(categorySummary).forEach(([categoryKey, categoryData]) => {
    const { earned, total } = categoryData;

    if (total > 0) {
      categoryData.percentage = (earned / total) * 100;
    }

    const weight = Number(categoryWeights[categoryKey] || 0);
    categoryData.weightedContribution =
      (categoryData.percentage * weight) / 100;
  });

  const finalGrade = Object.values(categorySummary).reduce(
    (sum, categoryData) => sum + categoryData.weightedContribution,
    0
  );

  return {
    categories: categorySummary,
    finalGrade: Number(finalGrade.toFixed(2)),
  };
}

/**
 * Checks that every grading category has at least one activity
 * with totalPoints > 0 in the given class + period.
 *
 * Returns { complete: boolean, missingCategories: string[] }
 */
async function isGradebookComplete(classId, academicPeriodId) {
  const activities = await Activity.find({
    class: classId,
    academicPeriod: academicPeriodId,
  }).lean();

  const presentCategories = new Set(
    activities
      .filter((a) => Number(a.totalPoints || 0) > 0)
      .map((a) => a.gradingCategory)
  );

  const missingCategories = CATEGORY_KEYS.filter(
    (key) => !presentCategories.has(key)
  );

  return {
    complete: missingCategories.length === 0,
    missingCategories,
  };
}

/**
 * Calculates grades for all (or one) student in a class,
 * optionally scoped to a single academic period.
 */
async function calculateClassGrades(classId, studentId = null, academicPeriodId = null) {
  const classRecord = await Class.findById(classId).lean();

  if (!classRecord) {
    throw new Error("Class not found");
  }

  const activityQuery = { class: classId };
  if (academicPeriodId) {
    activityQuery.academicPeriod = academicPeriodId;
  }

  const activities = await Activity.find(activityQuery).lean();

  const scoreQuery = { class: classId };
  const scores = await Score.find(scoreQuery).lean();

  const scoreMapByStudent = new Map();

  scores.forEach((score) => {
    const studentKey = String(score.student);

    if (!scoreMapByStudent.has(studentKey)) {
      scoreMapByStudent.set(studentKey, new Map());
    }

    scoreMapByStudent.get(studentKey).set(String(score.activity), score);
  });

  const targetStudentIds = studentId
    ? [studentId]
    : (classRecord.students || []).map((student) => String(student));

  return targetStudentIds.map((studentKey) => {
    const studentScores = scoreMapByStudent.get(studentKey) || new Map();

    const gradeSummary = calculateStudentGradeFromActivities({
      classRecord,
      activities,
      scoresByActivityId: studentScores,
    });

    return {
      studentId: studentKey,
      ...gradeSummary,
    };
  });
}

module.exports = {
  calculateClassGrades,
  calculateStudentGradeFromActivities,
  getCategoryWeights,
  isGradebookComplete,
};
