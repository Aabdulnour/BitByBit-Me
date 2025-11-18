import React, { useEffect, useMemo, useState } from "react";
import {
  persistViewMode,
  readStoredViewMode,
  type ViewMode,
} from "../../../lib/viewMode";
import {
  getCurrentStudentId,
  setCurrentStudentId,
} from "../../../lib/currentStudent";
import { apiGet } from "../../../lib/apiClient";
import { getCurrentUser } from "../../../lib/authClient";

const MODE_DESCRIPTIONS: Record<ViewMode, string> = {
  student: "Personalized practice, mastery tracking, and hints tuned to you.",
  teacher:
    "Teacher view lets you see class progress and focus areas. Use this for instructors or demo purposes.",
};

type StudentOption = {
  id: string;
  name: string;
  email?: string | null;
};

export default function SettingsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readStoredViewMode());
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState(() =>
    getCurrentStudentId()
  );
  const currentUser = useMemo(() => getCurrentUser(), []);
  const isTeacher = currentUser?.role === "teacher";

  useEffect(() => {
    let cancelled = false;
    async function loadStudents() {
      try {
        setStudentsLoading(true);
        setStudentsError(null);
        const data = await apiGet("/students");
        if (cancelled) return;
        const list: StudentOption[] = Array.isArray(data?.students)
          ? data.students.map((item: any) => ({
              id: item.id,
              name: item.name || item.id,
              email: item.email,
            }))
          : [];
        setStudents(list);
        const storedId = getCurrentStudentId();
        if (!cancelled) {
          if (storedId !== activeStudentId) {
            setActiveStudentId(storedId);
          }
        }
        if (list.length > 0 && !list.find((s) => s.id === storedId)) {
          const fallbackId = list[0].id;
          setActiveStudentId(fallbackId);
          setCurrentStudentId(fallbackId);
        }
      } catch (err) {
        console.error("Failed to load students", err);
        if (!cancelled) {
          setStudentsError("Unable to load students. Please try again later.");
        }
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    }
    loadStudents();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    persistViewMode(mode);
  };

  const handleStudentSelect = (studentId: string) => {
    setActiveStudentId(studentId);
    setCurrentStudentId(studentId);
  };

  const activeStudent = students.find((s) => s.id === activeStudentId);

  useEffect(() => {
    if (!isTeacher && viewMode !== "student") {
      handleModeChange("student");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  return (
    <div className="page settings-page">
      <div className="card settings-card">
        <h1 className="u-mt-0">Settings</h1>
        {isTeacher && (
          <section className="settings-section">
            <h3>View mode</h3>
            <p className="muted small">
              Preview student-facing dashboards or stay in the admin view.
            </p>
            <div className="settings-options">
              <label className="settings-option">
                <input
                  type="radio"
                  name="view-mode"
                  value="student"
                  checked={viewMode === "student"}
                  onChange={() => handleModeChange("student")}
                />
                <div>
                  <strong>Student view</strong>
                  <p className="muted small">{MODE_DESCRIPTIONS.student}</p>
                </div>
              </label>
              <label className="settings-option">
                <input
                  type="radio"
                  name="view-mode"
                  value="teacher"
                  checked={viewMode === "teacher"}
                  onChange={() => handleModeChange("teacher")}
                />
                <div>
                  <strong>Teacher view</strong>
                  <p className="muted small">{MODE_DESCRIPTIONS.teacher}</p>
                </div>
              </label>
            </div>
          </section>
        )}

        {viewMode === "student" && (
          <section className="settings-section">
            <h3>Active student</h3>
            <p className="muted small">
              Choose which student the dashboard should display.
            </p>
            {studentsLoading ? (
              <p className="muted small">Loading students…</p>
            ) : studentsError ? (
              <p className="error-text">{studentsError}</p>
            ) : students.length === 0 ? (
              <p className="muted small">
                No students found yet. Add a student from the teacher tool to get
                started.
              </p>
            ) : (
              <>
                <label className="settings-option">
                  <span className="muted small">Current student</span>
                  <select
                    className="input"
                    value={activeStudentId}
                    onChange={(event) => handleStudentSelect(event.target.value)}
                  >
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="muted small">
                  Student view will now show data for{" "}
                  <strong>{activeStudent?.name || activeStudentId}</strong>.
                </p>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
