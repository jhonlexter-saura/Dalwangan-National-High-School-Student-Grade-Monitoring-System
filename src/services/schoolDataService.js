const API_URL = "http://localhost:5000/api";

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("dnhs_token");

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

// -----------------------------
// Classes
// -----------------------------

export function getClasses() {
  return request("/classes");
}

export function createClass(data) {
  return request("/classes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export function getClassById(classId) {
  return request(`/classes/${classId}`);
}

export function updateClass(classId, data) {
  return request(`/classes/${classId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteClass(classId) {
  return request(`/classes/${classId}`, {
    method: "DELETE",
  });
}


export function getSubjectAssignments() {
  return request("/subject-assignments");
}

export function getSubjectAssignmentsByClass(classId) {
  return request(`/subject-assignments/class/${classId}`);
}

export function getSubjectAssignmentsByTeacher(userId) {
  return request(`/subject-assignments/teacher/${userId}`);
}

export function createSubjectAssignment(data) {
  return request("/subject-assignments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
export function deleteSubjectAssignment(assignmentId) {
  return request(`/subject-assignments/${assignmentId}`, {
    method: "DELETE",
  });
}


export function updateSubjectAssignment(id, data) {
  return request(`/subject-assignments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// -----------------------------
// Students
// -----------------------------

export function getStudents() {
  return request("/students");
}

export function getStudent(id) {
  return request(`/students/${id}`);
}

export function updateStudentProfile(id, data) {
  return request(`/students/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function createStudent(data) {
  return request("/students", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function addStudentToClass(studentId, classId) {
  return request(`/students/${studentId}/classes/${classId}`, {
    method: "POST",
  });
}

export function removeStudentFromClass(studentId, classId) {
  return request(`/students/${studentId}/classes/${classId}`, {
    method: "DELETE",
  });
}

export function addStudentsToClass(studentIds, classId) {
  return request(`/students/batch/classes/${classId}`, {
    method: "POST",
    body: JSON.stringify({ studentIds }),
  });
}

// -----------------------------
// Activities
// -----------------------------

export function getActivities() {
  return request("/activities");
}

export function getActivitiesByClass(classId) {
  return request(`/activities/class/${classId}`);
}

export function getActivitiesByAssignment(assignmentId) {
  return request(`/activities/assignment/${assignmentId}`);
}

export function createActivity(data) {
  return request("/activities", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// -----------------------------
// Scores
// -----------------------------

export function getScores() {
  return request("/scores");
}

export function getScoresByClass(classId) {
  return request(`/scores/class/${classId}`);
}

export function getScoresByActivity(activityId) {
  return request(`/scores/activity/${activityId}`);
}

export function saveScore(data) {
  return request("/scores", {
    method: "POST",
    body: JSON.stringify(data),
  });
}


export function getUsers() {
  return request("/users");
}

export function getUser(id) {
  return request(`/users/${id}`);
}

export function updateUserProfile(id, data) {
  return request(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function createUser(data) {
  return request("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getTeachers() {
  return request("/users?role=teacher");
}

export function getAdmins() {
  return request("/users?role=admin");
}

export function loginUser(data) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function forgotPassword(data) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function resetPassword(data) {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getClassesByTeacher(userId) {
  return request(`/classes/teacher/${userId}`);
}

export function createClassForTeacher(userId, data) {
  return request(`/classes/teacher/${userId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function addStudentToClassAsTeacher(
  studentId,
  classId,
  userId
) {
  return request(
    `/students/${studentId}/classes/${classId}/teacher/${userId}`,
    {
      method: "POST",
    }
  );
}

export function addStudentsToClassAsTeacher(
  studentIds,
  classId,
  userId
) {
  return request(
    `/students/batch/classes/${classId}/teacher/${userId}`,
    {
      method: "POST",
      body: JSON.stringify({ studentIds }),
    }
  );
}

export function getAcademicPeriods(schoolYear) {
  const query = schoolYear
    ? `?schoolYear=${encodeURIComponent(schoolYear)}`
    : "";

  return request(`/academic-periods${query}`);
}

export function createAcademicPeriod(data) {
  return request("/academic-periods", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAcademicPeriod(id, data) {
  return request(`/academic-periods/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteAcademicPeriod(id) {
  return request(`/academic-periods/${id}`, { method: "DELETE" });
}

export function updateTeacherAccountStatus(id, status) {
  return request(`/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function updateStudentAccountStatus(id, status) {
  return request(`/students/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}


export async function getMyProfile() {
  return request("/users/me", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("dnhs_token") || ""}`,
    },
  });
}

export async function updateMyProfile(profileData) {
  return request("/users/me", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("dnhs_token") || ""}`,
    },
    body: JSON.stringify(profileData),
  });
}

export function loginWithGoogle(credential) {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function getPublicIntegrationSettings() {
  return request("/integrations/public");
}

export function getIntegrationSettings() {
  return request("/integrations");
}

export function updateIntegrationSetting(key, enabled) {
  return request("/integrations", {
    method: "PATCH",
    body: JSON.stringify({ [key]: enabled }),
  });
}

// -----------------------------
// Grades
// -----------------------------

/**
 * Fetch all students' grades for a class scoped to one academic period.
 * Returns { grades, complete, missingCategories, finalized, finalizedAt }.
 */
export function getClassGradesByPeriod(classId, periodId) {
  return request(`/grades/class/${classId}/period/${periodId}`);
}

/**
 * Lightweight check: is the gradebook complete & finalized?
 * Returns { complete, missingCategories, finalized, finalizedAt }.
 */
export function getGradebookStatus(classId, periodId) {
  return request(`/grades/class/${classId}/period/${periodId}/status`);
}

export function getAssignmentGradebook(assignmentId, periodId) {
  return request(`/grades/assignment/${assignmentId}/period/${periodId}`);
}

export function getAssignmentGradebookStatus(assignmentId, periodId) {
  return request(`/grades/assignment/${assignmentId}/period/${periodId}/status`);
}

export function finalizeSubjectGradebook(assignmentId, periodId) {
  return request(`/grades/assignment/${assignmentId}/period/${periodId}/finalize`, {
    method: "POST",
  }).then((result) => {
    window.dispatchEvent(new Event("dnhs:notifications-updated"));
    return result;
  });
}

export function unlockSubjectGradebook(assignmentId, periodId) {
  return request(`/grades/assignment/${assignmentId}/period/${periodId}/unlock`, {
    method: "POST",
  }).then((result) => {
    window.dispatchEvent(new Event("dnhs:notifications-updated"));
    return result;
  });
}

/**
 * Finalizes the gradebook for a class + period.
 */
export function finalizeGradebook(classId, periodId) {
  return request(`/grades/class/${classId}/period/${periodId}/finalize`, {
    method: "POST",
  }).then((result) => {
    window.dispatchEvent(new Event("dnhs:notifications-updated"));
    return result;
  });
}

/**
 * Admin: unlock a finalized gradebook for a class + period.
 */
export function unlockGradebook(classId, periodId) {
  return request(`/grades/class/${classId}/period/${periodId}/unlock`, {
    method: "POST",
  }).then((result) => {
    window.dispatchEvent(new Event("dnhs:notifications-updated"));
    return result;
  });
}

export function getMyNotifications() {
  return request("/notifications/me");
}

export function markNotificationRead(notificationId) {
  return request(`/notifications/${notificationId}/read`, { method: "PATCH" }).then((result) => {
    window.dispatchEvent(new Event("dnhs:notifications-updated"));
    return result;
  });
}

export function markAllNotificationsRead() {
  return request("/notifications/read-all", { method: "PATCH" }).then((result) => {
    window.dispatchEvent(new Event("dnhs:notifications-updated"));
    return result;
  });
}

/**
 * Student: fetch all finalized grades across all enrolled classes.
 */
export function getMyGrades() {
  return request("/grades/student/me");
}
