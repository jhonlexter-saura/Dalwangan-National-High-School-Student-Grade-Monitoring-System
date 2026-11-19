const DEFAULT_CATEGORY_BY_TYPE = {
  quiz: "written_work",
  assignment: "written_work",
  project: "performance_task",
  performance_task: "performance_task",
  exam: "assessment",
  activity: "written_work",
};

const pointsAreValid = (points) =>
  Number.isFinite(points) && points >= 1 && points <= 1000;

/**
 * POST /activities
 * Checks the body shape and stores the cleaned result on req.activityData.
 * (DB checks like "does this class exist?" stay in the controller.)
 */
function validateCreateActivity(req, res, next) {
  const {
    title,
    description,
    classId,
    subjectAssignmentId,
    academicPeriodId,
    type,
    gradingCategory,
    totalPoints,
    date,
  } = req.body || {};

  const resolvedGradingCategory = gradingCategory || DEFAULT_CATEGORY_BY_TYPE[type];
  if (!resolvedGradingCategory) {
    return res.status(400).json({ error: "A valid grading category is required" });
  }

  if (
    !title?.trim() ||
    !classId ||
    !subjectAssignmentId ||
    !academicPeriodId ||
    !type ||
    totalPoints === undefined ||
    totalPoints === null ||
    totalPoints === "" ||
    !date
  ) {
    return res.status(400).json({
      error:
        "Title, class, subject, academic period, type, total points, and date are required",
    });
  }

  const points = Number(totalPoints);
  if (!pointsAreValid(points)) {
    return res.status(400).json({ error: "Total points must be between 1 and 1000" });
  }

  req.activityData = {
    title: title.trim(),
    description: description?.trim() || "",
    classId,
    subjectAssignmentId,
    academicPeriodId,
    type,
    gradingCategory: resolvedGradingCategory,
    totalPoints: points,
    date,
  };
  next();
}

/**
 * PUT /activities/:id
 * Partial update: only fields that were sent are validated, and only
 * those end up in req.activityUpdates for the controller to apply.
 */
function validateUpdateActivity(req, res, next) {
  const { title, description, gradingCategory, type, totalPoints, date } =
    req.body || {};
  const updates = {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title cannot be empty" });
    }
    updates.title = title.trim();
  }
  if (description !== undefined) {
    if (typeof description !== "string") {
      return res.status(400).json({ error: "Description must be text" });
    }
    updates.description = description.trim();
  }
  if (gradingCategory) updates.gradingCategory = gradingCategory;
  if (type) updates.type = type;
  if (totalPoints !== undefined) {
    const points = Number(totalPoints);
    if (!pointsAreValid(points)) {
      return res.status(400).json({ error: "Total points must be between 1 and 1000" });
    }
    updates.totalPoints = points;
  }
  if (date) updates.date = date;

  req.activityUpdates = updates;
  next();
}

module.exports = { validateCreateActivity, validateUpdateActivity };