const mongoose = require("mongoose");
const dns = require("dns");
const Gradebook = require("../models/Gradebook");

// Use public DNS servers for MongoDB Atlas SRV resolution
dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const gradebookIndexes = await Gradebook.collection.indexes();
    if (gradebookIndexes.some((index) => index.name === "class_1_academicPeriod_1")) {
      await Gradebook.collection.dropIndex("class_1_academicPeriod_1");
    }
    await Gradebook.syncIndexes();

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error.message);

    process.exit(1);
  }
}

module.exports = connectDB;
