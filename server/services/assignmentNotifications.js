const Notification = require("../models/Notification");
const Student = require("../models/Student");

async function notifyTeacherOfAssignment({ teacher, classRecord, subject, assignmentId }) {
  if (!teacher?.user) return;
  try {
    await Notification.create({
      recipient: teacher.user,
      type: "subject_assigned",
      title: "New subject assignment",
      message: `You have been assigned to teach ${subject} for ${classRecord.name} · Section ${classRecord.section} (Grade ${classRecord.gradeLevel}).`,
      link: `/teacher/classes/${classRecord._id}`,
    });
  } catch (error) {
    // Assignment changes should succeed even if notification delivery fails.
    console.error(`Failed to notify teacher about assignment ${assignmentId}:`, error.message);
  }
}

async function notifyStudentsOfSubject({ classRecord, subject, teacherName, teacherChanged = false }) {
  try {
    const students = await Student.find({
      _id: { $in: classRecord.students || [] },
      user: { $ne: null },
    })
      .select("user")
      .lean();
    if (!students.length) return;
    const notification = teacherChanged
      ? {
          type: "student_teacher_assigned",
          title: "Teacher assigned to your subject",
          message: `${teacherName} has been assigned to teach ${subject} in ${classRecord.name} · Section ${classRecord.section}.`,
        }
      : {
          type: "student_subject_added",
          title: "New subject added to your class",
          message: `${subject} has been added to ${classRecord.name} · Section ${classRecord.section}.`,
        };
    await Notification.insertMany(
      students.map(({ user }) => ({
        ...notification,
        recipient: user,
        link: "/student/grades",
      }))
    );
  } catch (error) {
    console.error("Failed to notify students about subject assignment:", error.message);
  }
}

module.exports = { notifyTeacherOfAssignment, notifyStudentsOfSubject };