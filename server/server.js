const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const dns = require("dns");
const path = require("path");

const connectDB = require("./config/db");

const classRoutes = require("./routes/classes");
const studentRoutes = require("./routes/students");
const activityRoutes = require("./routes/activities");
const scoreRoutes = require("./routes/scores");
const userRoutes = require("./routes/users");
const academicPeriodRoutes = require("./routes/academicPeriods");
const authRoutes = require("./routes/auth");
const gradeRoutes = require("./routes/grades");
const notificationRoutes = require("./routes/notifications");
const subjectAssignmentRoutes = require("./routes/subjectAssignments");
const integrationRoutes = require("./routes/integrations");
const auditLogRoutes = require("./routes/auditLogs");
const passkeyRoutes = require("./routes/passkeys");

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

const app = express();

app.use(cors());
app.use(express.json());

const apiV1 = express.Router();

apiV1.get("/data", (req, res) => {
  res.json({
    version: "v1",
    status: "active",
    name: "DNHS-SGMS API v1",
    endpoints: {
      auth: "/api/v1/auth",
      passkeys: "/api/v1/auth/passkeys",
      integrations: "/api/v1/integrations",
      classes: "/api/v1/classes",
      students: "/api/v1/students",
      activities: "/api/v1/activities",
      scores: "/api/v1/scores",
      academicPeriods: "/api/v1/academic-periods",
      grades: "/api/v1/grades",
      notifications: "/api/v1/notifications",
      subjectAssignments: "/api/v1/subject-assignments",
      users: "/api/v1/users",
      auditLogs: "/api/v1/audit-logs",
    },
  });
});

apiV1.use("/auth/passkeys", passkeyRoutes);
apiV1.use("/auth", authRoutes);
apiV1.use("/integrations", integrationRoutes);

apiV1.use("/classes", classRoutes);
apiV1.use("/students", studentRoutes);
apiV1.use("/activities", activityRoutes);
apiV1.use("/scores", scoreRoutes);
apiV1.use("/academic-periods", academicPeriodRoutes);
apiV1.use("/grades", gradeRoutes);
apiV1.use("/notifications", notificationRoutes);
apiV1.use("/subject-assignments", subjectAssignmentRoutes);
apiV1.use("/users", userRoutes);
apiV1.use("/audit-logs", auditLogRoutes);

// Mount API version 1
app.use("/api/v1", apiV1);
// Backwards compatibility alias for existing consumers
app.use("/api", apiV1);

app.get("/", (req, res) => {
  res.json({
    message: "DNHS-SGMS API is running",
  });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
