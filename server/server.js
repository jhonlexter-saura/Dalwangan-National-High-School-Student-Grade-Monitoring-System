const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const dns = require("dns");
const path = require("path");
const mongoose = require("mongoose");

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

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

let usingBackup = false;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    usingBackup = false;
    console.log(`✅ Main MongoDB Connected (PRIMARY): ${conn.connection.host}`);
  } catch (mainError) {
    console.warn(`⚠️ Main MongoDB failed (${mainError.message}). Switching to Backup...`);
    try {
      const backupConn = await mongoose.connect(process.env.BACKUP_MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      usingBackup = true;
      console.log(`✅ Backup MongoDB Connected (PROMOTED TO PRIMARY): ${backupConn.connection.host}`);
    } catch (backupError) {
      console.error(`❌ Both Main and Backup MongoDB failed: ${backupError.message}`);
      process.exit(1);
    }
  }
};

// Automatic live failover if Main disconnects while the server is already running
mongoose.connection.on("disconnected", async () => {
  if (!usingBackup) {
    usingBackup = true;
    console.warn("⚠️ Main MongoDB disconnected mid-session! Switching to Backup...");
    try {
      const backupConn = await mongoose.connect(process.env.BACKUP_MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`✅ Backup MongoDB Connected (PROMOTED TO PRIMARY): ${backupConn.connection.host}`);
    } catch (err) {
      console.error("❌ Failed to switch to Backup MongoDB:", err.message);
    }
  }
});

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/integrations", integrationRoutes);

app.use("/api/classes", classRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/scores", scoreRoutes);
app.use("/api/academic-periods", academicPeriodRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/subject-assignments", subjectAssignmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditLogRoutes);

app.get("/", (req, res) => {
  const activeHost = mongoose.connection.host || "Not connected";
  const isBackupActive = usingBackup || activeHost.includes("tsm7wvj");

  res.json({
    message: "DNHS-SGMS API is running",
    activeDatabase: isBackupActive
      ? "BACKUP DATABASE (Promoted to Primary)"
      : "MAIN DATABASE (Primary)",
    connectedHost: activeHost,
    status: mongoose.connection.readyState === 1 ? "Online" : "Disconnected",
  });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
