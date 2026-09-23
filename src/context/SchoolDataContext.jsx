import {
  createContext,
  useContext,
  useState,
} from "react";

const SchoolDataContext = createContext(null);

export function SchoolDataProvider({ children }) {
  const [classes, setClasses] = useState([
    {
      id: 1,
      name: "Grade 10 - ICT A",
      adviser: "Maria Santos",
      schoolYear: "2026-2027",
      students: [
        {
          id: 101,
          name: "Juan Dela Cruz",
          email: "juan@example.com",
        },
        {
          id: 102,
          name: "Ana Reyes",
          email: "ana@example.com",
        },
        {
          id: 103,
          name: "Mark Santos",
          email: "mark@example.com",
        },
      ],
    },
    {
      id: 2,
      name: "Grade 9 - ICT A",
      adviser: "Juan Reyes",
      schoolYear: "2026-2027",
      students: [
        {
          id: 104,
          name: "Sofia Cruz",
          email: "sofia@example.com",
        },
        {
          id: 105,
          name: "Daniel Reyes",
          email: "daniel@example.com",
        },
      ],
    },
  ]);

  const [activities, setActivities] = useState([
    {
      id: 1,
      title: "Quiz 1",
      classId: 1,
      type: "Quiz",
      totalPoints: 20,
      date: "2026-09-20",
    },
    {
      id: 2,
      title: "Performance Task 1",
      classId: 1,
      type: "Performance Task",
      totalPoints: 50,
      date: "2026-09-22",
    },
    {
      id: 3,
      title: "Quiz 1",
      classId: 2,
      type: "Quiz",
      totalPoints: 20,
      date: "2026-09-21",
    },
  ]);

  const [scores, setScores] = useState([]);

  // -----------------------------
  // Classes
  // -----------------------------

  const createClass = (classData) => {
    const newClass = {
      id: Date.now(),
      ...classData,
      students: [],
    };

    setClasses((prev) => [...prev, newClass]);

    return newClass;
  };

  // -----------------------------
  // Students
  // -----------------------------

  const inviteStudent = (classId, studentData) => {
    const newStudent = {
      id: Date.now(),
      ...studentData,
    };

    setClasses((prev) =>
      prev.map((classItem) =>
        classItem.id === classId
          ? {
              ...classItem,
              students: [
                ...classItem.students,
                newStudent,
              ],
            }
          : classItem
      )
    );

    return newStudent;
  };

  // -----------------------------
  // Activities
  // -----------------------------

  const createActivity = (activityData) => {
    const newActivity = {
      id: Date.now(),
      ...activityData,
    };

    setActivities((prev) => [
      ...prev,
      newActivity,
    ]);

    return newActivity;
  };

  // -----------------------------
  // Scores
  // -----------------------------

  const saveScores = ({
    classId,
    activityId,
    scoreData,
  }) => {
    const activity = activities.find(
      (item) => item.id === activityId
    );

    if (!activity) {
      return;
    }

    setScores((prev) => {
      const updatedScores = [...prev];

      Object.entries(scoreData).forEach(
        ([studentId, score]) => {
          // Do not save blank score fields.
          if (score === "") {
            return;
          }

          const numericScore = Number(score);

          // Reject invalid, negative, or over-the-limit scores.
          if (
            Number.isNaN(numericScore) ||
            numericScore < 0 ||
            numericScore > activity.totalPoints
          ) {
            return;
          }

          const existingIndex =
            updatedScores.findIndex(
              (item) =>
                item.classId === classId &&
                item.activityId === activityId &&
                item.studentId === Number(studentId)
            );

          const scoreRecord = {
            classId,
            activityId,
            studentId: Number(studentId),
            score: numericScore,
          };

          if (existingIndex >= 0) {
            updatedScores[existingIndex] = scoreRecord;
          } else {
            updatedScores.push(scoreRecord);
          }
        }
      );

      return updatedScores;
    });
  };

  return (
    <SchoolDataContext.Provider
      value={{
        classes,
        activities,
        scores,

        createClass,
        inviteStudent,
        createActivity,
        saveScores,
      }}
    >
      {children}
    </SchoolDataContext.Provider>
  );
}

export function useSchoolData() {
  return useContext(SchoolDataContext);
}