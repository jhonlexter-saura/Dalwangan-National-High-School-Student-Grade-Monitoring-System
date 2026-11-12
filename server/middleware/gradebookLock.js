const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const SubjectAssignment = require("../models/SubjectAssignment");
const {
  acquireGradebookLock,
  renewGradebookLock,
  releaseGradebookLock,
  LOCK_LEASE_MS,
} = require("../services/gradebookLock");

const RENEW_INTERVAL_MS = Math.floor(LOCK_LEASE_MS / 3);

function withGradebookLock(resolveScope) {
  return async (req, res, next) => {
    let lock;
    let renewTimer;
    let released = false;

    const release = async () => {
      if (released) return;
      released = true;
      if (renewTimer) clearInterval(renewTimer);
      try {
        await releaseGradebookLock(lock);
      } catch (error) {
        console.error("Failed to release gradebook lock:", error.message);
      }
    };

    try {
      const scope = await resolveScope(req);
      if (!scope || !mongoose.isValidObjectId(scope.classId) || !mongoose.isValidObjectId(scope.periodId)) {
        return next();
      }

      lock = await acquireGradebookLock(scope.classId, scope.periodId);
      if (!lock) {
        res.set("Retry-After", "2");
        return res.status(423).json({ error: "This class gradebook is being updated. Please retry shortly." });
      }

      req.gradebookActivity = scope.activity || null;
      renewTimer = setInterval(() => {
        void renewGradebookLock(lock).then((renewed) => {
          if (!renewed) {
            clearInterval(renewTimer);
            console.warn("Gradebook lock lease expired before the request finished.");
          }
        }).catch((error) => console.error("Failed to renew gradebook lock:", error.message));
      }, RENEW_INTERVAL_MS);
      renewTimer.unref?.();

      res.once("finish", () => { void release(); });
      return next();
    } catch (error) {
      await release();
      return next(error);
    }
  };
}

const lockGradebookByClassPeriod = withGradebookLock((req) => ({
  classId: req.params.classId,
  periodId: req.params.periodId,
}));

const lockGradebookByAssignmentPeriod = withGradebookLock(async (req) => {
  if (!mongoose.isValidObjectId(req.params.assignmentId)) return null;
  const assignment = await SubjectAssignment.findById(req.params.assignmentId).select("class").lean();
  return assignment ? { classId: assignment.class, periodId: req.params.periodId } : null;
});

const lockGradebookForScore = withGradebookLock(async (req) => {
  const { classId, activityId } = req.body || {};
  if (!mongoose.isValidObjectId(classId) || !mongoose.isValidObjectId(activityId)) return null;
  const activity = await Activity.findById(activityId);
  return activity ? { classId, periodId: activity.academicPeriod, activity } : null;
});

const lockGradebookForActivity = withGradebookLock((req) => ({
  classId: req.body?.classId,
  periodId: req.body?.academicPeriodId,
}));

module.exports = {
  lockGradebookByClassPeriod,
  lockGradebookByAssignmentPeriod,
  lockGradebookForScore,
  lockGradebookForActivity,
};
