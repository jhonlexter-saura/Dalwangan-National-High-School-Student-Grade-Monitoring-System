const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, ".env"), override: true });

async function syncOnlineDatabases() {
  const mainUri = (process.env.MONGODB_URI || "").trim();
  const backupUri = "mongodb+srv://tinysaturn04_db_user:DNHS-SGMS@dnhs-sgms-backup.tsm7wvj.mongodb.net/test?appName=dnhs-sgms-backup";

  console.log("Connecting to Main Online Atlas Database...");
  const mainConn = await mongoose.createConnection(mainUri).asPromise();

  console.log("Connecting to Backup Online Atlas Database...");
  const backupConn = await mongoose.createConnection(backupUri).asPromise();

  try {
    const collections = await mainConn.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections to back up.`);

    for (const col of collections) {
      const name = col.name;
      if (name.startsWith("system.")) continue;

      const data = await mainConn.db.collection(name).find({}).toArray();

      await backupConn.db.collection(name).deleteMany({});
      if (data.length > 0) {
        await backupConn.db.collection(name).insertMany(data);
      }

      console.log(`Copied ${data.length} records -> ${name}`);
    }

    console.log("Online backup complete! Both Atlas clusters are now synced.");
  } catch (error) {
    console.error("Backup error:", error.message);
  } finally {
    await mainConn.close();
    await backupConn.close();
  }
}

syncOnlineDatabases();
