import { useEffect, useState } from "react";
import { Plus, Users, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import {
  getClassesByTeacher,
  createClassForTeacher,
} from "../../services/schoolDataService";

function TeacherClasses() {
  const { user } = useAuth();

  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    section: "",
    gradeLevel: "",
    schoolYear: "2026-2027",
  });

  const loadClasses = async () => {
    if (!user?._id) return;

    try {
      setLoading(true);
      setError("");

      const data = await getClassesByTeacher(user._id);
      setClasses(data);
    } catch (err) {
      console.error("Failed to load teacher classes:", err);
      setError(err.message || "Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, [user?._id]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();

    try {
      setError("");

      const createdClass = await createClassForTeacher(
        user._id,
        formData
      );

      setClasses((prev) => [createdClass, ...prev]);

      setFormData({
        name: "",
        section: "",
        gradeLevel: "",
        schoolYear: "2026-2027",
      });

      setShowCreateForm(false);
    } catch (err) {
      console.error("Failed to create class:", err);
      setError(err.message || "Failed to create class");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            My Classes
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage the classes assigned to you.
          </p>
        </div>

        <button
          onClick={() => setShowCreateForm((prev) => !prev)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Class
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Create Class
          </h2>

          <form
            onSubmit={handleCreateClass}
            className="mt-5 grid gap-5 md:grid-cols-2"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Class Name
              </label>

              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Grade 10 - Mathematics"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Section
              </label>

              <input
                name="section"
                value={formData.section}
                onChange={handleChange}
                placeholder="e.g. Rizal"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Grade Level
              </label>

              <select
                name="gradeLevel"
                value={formData.gradeLevel}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select grade level</option>
                <option value="7">Grade 7</option>
                <option value="8">Grade 8</option>
                <option value="9">Grade 9</option>
                <option value="10">Grade 10</option>
                <option value="11">Grade 11</option>
                <option value="12">Grade 12</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                School Year
              </label>

              <select
                name="schoolYear"
                value={formData.schoolYear}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="2026-2027">2026-2027</option>
                <option value="2027-2028">2027-2028</option>
              </select>
            </div>

            <div className="flex gap-3 md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Class
              </button>

              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Classes */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Loading classes...
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <GraduationCap
            size={40}
            className="mx-auto text-gray-400"
          />

          <h2 className="mt-4 font-semibold text-gray-900">
            No classes yet
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Create your first class to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((item) => (
            <div
              key={item._id}
              onClick={() => 
                navigate(`/teacher/classes/${item._id}`)
              }
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {item.name}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Section {item.section}
                  </p>
                </div>

                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <GraduationCap size={20} />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 text-sm text-gray-500">
                <Users size={17} />

                <span>
                  {item.students?.length || 0} students
                </span>
              </div>

              <div className="mt-3 text-sm text-gray-500">
                Grade {item.gradeLevel}
              </div>

              <div className="mt-1 text-sm text-gray-500">
                School Year {item.schoolYear}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TeacherClasses;