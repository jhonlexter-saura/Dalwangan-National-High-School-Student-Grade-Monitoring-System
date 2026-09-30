import { createContext, useContext, useEffect, useState } from "react";
import {
  getClasses,
  getActivities,
  getScores,
  createClass as apiCreateClass,
  createStudent,
  addStudentToClass,
  createActivity as apiCreateActivity,
  saveScore,
} from "../services/schoolDataService";

const SchoolDataContext = createContext(null);

const normalizeStudent = (student) => ({
  ...student,
  id: student._id,
});

const normalizeClass = (item) => ({
  ...item,
  id: item._id,
  students: (item.students || []).map(normalizeStudent),
});

const normalizeActivity = (activity) => ({
  ...activity,
  id: activity._id,

  classId:
    activity.class?._id || activity.class,

  academicPeriodId:
    activity.academicPeriod?._id ||
    activity.academicPeriod,

  date: activity.date
    ? String(activity.date).slice(0, 10)
    : "",
});

const normalizeScore = (score) => ({
  ...score,
  id: score._id,
  studentId: score.student?._id || score.student,
  classId: score.class?._id || score.class,
  activityId: score.activity?._id || score.activity,
});

export function SchoolDataProvider({ children }) {
  const [classes, setClasses] = useState([]);
  const [activities, setActivities] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [classesData, activitiesData, scoresData] = await Promise.all([
        getClasses(),
        getActivities(),
        getScores(),
      ]);
      setClasses(classesData.map(normalizeClass));
      setActivities(activitiesData.map(normalizeActivity));
      setScores(scoresData.map(normalizeScore));
    } catch (err) {
      console.error("Failed to load school data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateClass = async (classData) => {
    const created = await apiCreateClass(classData);
    const newClass = normalizeClass(created);
    setClasses((prev) => [...prev, newClass]);
    return newClass;
  };

  const handleInviteStudent = async (classId, studentData) => {
    const student = await createStudent(studentData);
    const result = await addStudentToClass(student._id, classId);
    const updatedClass = normalizeClass(result.class);

    setClasses((prev) =>
      prev.map((item) => (item.id === classId ? updatedClass : item))
    );

    return normalizeStudent(student);
  };

  const handleCreateActivity = async (activityData) => {
    const created = await apiCreateActivity(activityData);
    const newActivity = normalizeActivity(created);
    setActivities((prev) => [...prev, newActivity]);
    return newActivity;
  };

  const handleSaveScores = async ({ classId, activityId, scoreData }) => {
    const savedScores = [];

    for (const [studentId, score] of Object.entries(scoreData)) {
      if (score === "") continue;

      const saved = await saveScore({
        studentId,
        classId,
        activityId,
        score: Number(score),
      });

      savedScores.push(normalizeScore(saved));
    }

    setScores((prev) => {
      const updated = [...prev];
      for (const newScore of savedScores) {
        const index = updated.findIndex(
          (item) =>
            item.studentId === newScore.studentId &&
            item.activityId === newScore.activityId
        );
        if (index >= 0) updated[index] = newScore;
        else updated.push(newScore);
      }
      return updated;
    });

    return savedScores;
  };

  return (
    <SchoolDataContext.Provider
      value={{
        classes,
        activities,
        scores,
        loading,
        error,
        reloadData: loadData,
        createClass: handleCreateClass,
        inviteStudent: handleInviteStudent,
        createActivity: handleCreateActivity,
        saveScores: handleSaveScores,
      }}
    >
      {children}
    </SchoolDataContext.Provider>
  );
}

export function useSchoolData() {
  return useContext(SchoolDataContext);
}
