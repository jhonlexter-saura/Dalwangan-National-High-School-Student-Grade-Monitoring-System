const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const dns = require("dns");

const connectDB = require("./config/db");

const classRoutes = require("./routes/classes");
const studentRoutes = require("./routes/students");

dotenv.config();

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/classes", classRoutes);
app.use("/api/students", studentRoutes);

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