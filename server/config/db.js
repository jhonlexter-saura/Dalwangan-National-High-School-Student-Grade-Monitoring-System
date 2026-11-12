const mongoose = require("mongoose");
const dns = require("dns");
const Gradebook = require("../models/Gradebook");
const GradebookLock = require("../models/GradebookLock");

// Use public DNS servers for MongoDB Atlas SRV resolution
dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

async function connectDB() {
  try {
    await mongoose.connect(process.env.CUSTOM_DATABASE_URI?.trim() || process.env.MONGODB_URI);

    const gradebookIndexes = await Gradebook.collection.indexes();
    if (gradebookIndexes.some((index) =>
      index.name === "class_1_academicPeriod_1" &&
      !(index.unique && index.partialFilterExpression?.subjectAssignment?.$type === "null")
    )) {
      await Gradebook.collection.dropIndex("class_1_academicPeriod_1");
    }
    await Gradebook.syncIndexes();
    await GradebookLock.init();

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error.message);

    process.exit(1);
  }
}

module.exports = connectDB;
