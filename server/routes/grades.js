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
const gradebook = require("../controller/gradebookController");
const student = require("../controller/studentGradeController");

const router = express.Router();

const teacherOrAdmin = requireRoles(["admin", "teacher"], "Teacher or administrator access is required");
const adminOnly = requireRoles(["admin"], "Administrator access is required");
const studentOnly = requireRoles(["student"], "Student access is required");

// ----- Subject (assignment) gradebooks -----
router.get("/assignment/:assignmentId/period/:periodId", requireAuthenticatedUser, gradebook.getAssignmentGradebook);
router.get("/assignment/:assignmentId/period/:periodId/status", requireAuthenticatedUser, gradebook.getAssignmentGradebookStatus);
router.post("/assignment/:assignmentId/period/:periodId/finalize", requireAuthenticatedUser, lockGradebookByAssignmentPeriod, validateAssignmentPeriodIds, teacherOrAdmin, gradebook.finalizeAssignmentGradebook);
router.post("/assignment/:assignmentId/period/:periodId/unlock", requireAuthenticatedUser, lockGradebookByAssignmentPeriod, adminOnly, gradebook.unlockAssignmentGradebook);

// ----- Class gradebooks -----
router.get("/class/:classId", gradebook.getClassGrades);
router.get("/class/:classId/student/:studentId", gradebook.getStudentClassGrade);
router.get("/class/:classId/period/:periodId", gradebook.getClassPeriodGrades);
router.get("/class/:classId/period/:periodId/status", gradebook.getClassPeriodStatus);
router.post("/class/:classId/period/:periodId/finalize", requireAuthenticatedUser, lockGradebookByClassPeriod, teacherOrAdmin, validateClassPeriodIds, gradebook.finalizeClassGradebook);
router.post("/class/:classId/period/:periodId/unlock", requireAuthenticatedUser, lockGradebookByClassPeriod, adminOnly, validateClassPeriodIds, gradebook.unlockClassGradebook);

// ----- Student's own grades (specific paths first) -----
router.get("/student/me/class/:classId/period/:periodId", requireBearerUserId, student.getMyClassPeriodGrade);
router.get("/student/me/dashboard", requireAuthenticatedUser, studentOnly, student.getMyDashboard);
router.get("/student/me", requireBearerUserId, student.getMyGrades);

module.exports = router;