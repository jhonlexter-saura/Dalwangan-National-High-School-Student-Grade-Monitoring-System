const Student = require("../models/Student");
const Class = require("../models/Class");
const Notification = require("../models/Notification");

async function notifyStudentsOfEnrollment(students, classRecord) {
  const recipients = [
    ...new Set(students.map((student) => student?.user).filter(Boolean).map(String)),
  ];
  if (!recipients.length) return;
  try {
    await Notification.insertMany(
      recipients.map((recipient) => ({
        recipient,
        type: "class_assigned",
        title: "You were added to a class",
        message: `You have been enrolled in ${classRecord.name} · Section ${classRecord.section} (Grade ${classRecord.gradeLevel}).`,
        link: "/student",
      }))
    );
  } catch (error) {
    // Keep the enrollment successful even if creating a notification fails.
    console.error("Failed to notify students about class enrollment:", error.message);
  }
}

async function notifyStudentIdsOfEnrollment(studentIds, classRecord) {
  try {
    const students = await Student.find({ _id: { $in: studentIds } }).select("user").lean();
    await notifyStudentsOfEnrollment(students, classRecord);
  } catch (error) {
    // Notification lookup failures must not roll back a saved enrollment.
    console.error("Failed to look up enrolled student accounts:", error.message);
  }
}

async function syncStudentClassDetails(studentIds, classRecord) {
  try {
    await Student.updateMany(
      { _id: { $in: studentIds } },
      {
        $set: {
          gradeLevel: classRecord.gradeLevel,
          section: classRecord.section,
          schoolYear: classRecord.schoolYear,
        },
      }
    );
  } catch (error) {
    // Enrollment remains valid if the profile metadata update needs to be retried.
    console.error("Failed to sync student class details:", error.message);
  }
}

// Returns the IDs that were really added (skips any already in the class).
async function addStudentsAtomically(classId, studentIds) {
  const results = await Promise.all(
    studentIds.map((studentId) =>
      Class.findOneAndUpdate(
        { _id: classId, students: { $ne: studentId } },
        { $addToSet: { students: studentId } },
        { new: true }
      )
        .select("_id")
        .lean()
    )
  );
  return studentIds.filter((_, index) => Boolean(results[index]));
}

async function addStudentAtomically(classId, studentId) {
  return Class.findOneAndUpdate(
    { _id: classId, students: { $ne: studentId } },
    { $addToSet: { students: studentId } },
    { new: true }
  )
    .select("_id")
    .lean();
}

module.exports = {
  notifyStudentsOfEnrollment,
  notifyStudentIdsOfEnrollment,
  syncStudentClassDetails,
  addStudentsAtomically,
  addStudentAtomically,
};