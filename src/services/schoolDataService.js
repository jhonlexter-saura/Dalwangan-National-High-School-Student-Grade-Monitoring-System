const API_URL = "http://localhost:5000/api";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();

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

// -----------------------------
// Students
// -----------------------------

export function getStudents() {
  return request("/students");
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

// -----------------------------
// Activities
// -----------------------------

export function getActivities() {
  return request("/activities");
}

export function getActivitiesByClass(classId) {
  return request(`/activities/class/${classId}`);
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