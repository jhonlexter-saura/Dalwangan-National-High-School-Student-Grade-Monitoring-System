require("dotenv").config();

const connectDB = require("./config/db");

const Class = require("./models/Class");
const Student = require("./models/Student");
const Activity = require("./models/Activity");
const Score = require("./models/Score");

async function testModels() {
  await connectDB();

  console.log("Class model:", Class.modelName);
  console.log("Student model:", Student.modelName);
  console.log("Activity model:", Activity.modelName);
  console.log("Score model:", Score.modelName);

  process.exit(0);
}

testModels();