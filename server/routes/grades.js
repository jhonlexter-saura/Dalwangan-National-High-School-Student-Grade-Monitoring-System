const express = require("express");

const { requireAuthenticatedUser } = require("../middleware/authorization");
const {
  lockGradebookByClassPeriod,
  lockGradebookByAssignmentPeriod,
} = require("../middleware/gradebookLock");
const {
  requireRoles,
  requireBearerUserId,
  validateAssignmentPeriodIds,
  validateClassPeriodIds,
} = require("../middleware/gradeGuards");
const {
  dataModificationLimiter,
  reportGenerationLimiter,
  searchFilterLimiter,
} = require("../middleware/rateLimits");
const gradebook = require("../controller/gradebookController");
const student = require("../controller/studentGradeController");

const router = express.Router();

const teacherOrAdmin = requireRoles(["admin", "teacher"], "Teacher or administrator access is required");
const adminOnly = requireRoles(["admin"], "Administrator access is required");
const studentOnly = requireRoles(["student"], "Student access is required");

// ----- Subject (assignment) gradebooks -----
router.get("/assignment/:assignmentId/period/:periodId", requireAuthenticatedUser, reportGenerationLimiter, gradebook.getAssignmentGradebook);
router.get("/assignment/:assignmentId/period/:periodId/status", requireAuthenticatedUser, searchFilterLimiter, gradebook.getAssignmentGradebookStatus);
router.post("/assignment/:assignmentId/period/:periodId/finalize", requireAuthenticatedUser, dataModificationLimiter, lockGradebookByAssignmentPeriod, validateAssignmentPeriodIds, teacherOrAdmin, gradebook.finalizeAssignmentGradebook);
router.post("/assignment/:assignmentId/period/:periodId/unlock", requireAuthenticatedUser, dataModificationLimiter, lockGradebookByAssignmentPeriod, adminOnly, gradebook.unlockAssignmentGradebook);

// ----- Class gradebooks -----
router.get("/class/:classId", searchFilterLimiter, gradebook.getClassGrades);
router.get("/class/:classId/student/:studentId", searchFilterLimiter, gradebook.getStudentClassGrade);
router.get("/class/:classId/period/:periodId", reportGenerationLimiter, gradebook.getClassPeriodGrades);
router.get("/class/:classId/period/:periodId/status", searchFilterLimiter, gradebook.getClassPeriodStatus);
router.post("/class/:classId/period/:periodId/finalize", requireAuthenticatedUser, dataModificationLimiter, lockGradebookByClassPeriod, teacherOrAdmin, validateClassPeriodIds, gradebook.finalizeClassGradebook);
router.post("/class/:classId/period/:periodId/unlock", requireAuthenticatedUser, dataModificationLimiter, lockGradebookByClassPeriod, adminOnly, validateClassPeriodIds, gradebook.unlockClassGradebook);

// ----- Student's own grades (specific paths first) -----
router.get("/student/me/class/:classId/period/:periodId", requireBearerUserId, searchFilterLimiter, student.getMyClassPeriodGrade);
router.get("/student/me/dashboard", requireAuthenticatedUser, reportGenerationLimiter, studentOnly, student.getMyDashboard);
router.get("/student/me", requireBearerUserId, searchFilterLimiter, student.getMyGrades);

module.exports = router;