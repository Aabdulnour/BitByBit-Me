import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchTeacherOverview,
  fetchTeacherStudentDetail,
  type TeacherStudentSummary,
  type TeacherUnitSummary,
} from "../../../lib/teacherClient";
import { normalizeAttempts } from "../../../lib/attempts";
import StudentDetailDrawer, {
  type StudentDetailState,
} from "../components/StudentDetailDrawer";

const initialOverview = { students: [], units: [] };

type OverviewState = {
  students: TeacherStudentSummary[];
  units: TeacherUnitSummary[];
};

function formatLastActivity(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatCount(count: number) {
  return count.toLocaleString();
}

export default function TeacherDashboard() {
  const [overview, setOverview] = useState<OverviewState>(initialOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<Record<string, StudentDetailState>>({});

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeacherOverview();
      setOverview({ students: data.students, units: data.units });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const fetchStudentDetail = useCallback(async (studentId: string) => {
    setStudentDetails((prev) => ({
      ...prev,
      [studentId]: { loading: true, error: null, data: prev[studentId]?.data ?? null },
    }));
    try {
      const data = await fetchTeacherStudentDetail(studentId);
      const normalizedAttempts = normalizeAttempts(data.attempts || []);
      const formattedMastery = (data.unit_mastery || []).map((entry) => ({
        unitId: entry.unit_id,
        unitName: entry.unit_name,
        mastery: Math.round(entry.mastery ?? 0),
      }));
      setStudentDetails((prev) => ({
        ...prev,
        [studentId]: {
          loading: false,
          error: null,
          data: {
            student: data.student,
            unitMastery: formattedMastery,
            attempts: normalizedAttempts,
          },
        },
      }));
    } catch (err) {
      setStudentDetails((prev) => ({
        ...prev,
        [studentId]: {
          loading: false,
          error: err instanceof Error ? err.message : "Unable to load student",
          data: null,
        },
      }));
    }
  }, []);

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    const detailState = studentDetails[studentId];
    if (!detailState || (!detailState.loading && !detailState.data && !detailState.error)) {
      fetchStudentDetail(studentId);
    }
  };

  const closeDrawer = () => setSelectedStudentId(null);

  const activeSummary = useMemo(() => {
    if (!selectedStudentId) return undefined;
    return overview.students.find((s) => s.student_id === selectedStudentId);
  }, [overview.students, selectedStudentId]);

  return (
    <div className="page teacher-dashboard">
      <div className="page-header">
        <div>
          <p className="muted small">Teacher tools</p>
          <h1>Class overview 🎓</h1>
          <p className="muted">
            See how your students are progressing and where to focus support.
          </p>
        </div>
      </div>

      {loading && (
        <div className="card teacher-card">
          <p className="muted small">Loading class insights…</p>
        </div>
      )}

      {!loading && error && (
        <div className="card teacher-card">
          <p className="error-text">{error}</p>
          <button className="btn" onClick={loadOverview}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="teacher-grid">
          <div className="card teacher-card">
            <div className="card-header">
              <div>
                <h2>Students</h2>
                <p className="muted small">
                  Track mastery, questions answered, and recent activity.
                </p>
              </div>
            </div>
            {overview.students.length === 0 ? (
              <p className="muted small">Add students to view their progress.</p>
            ) : (
              <div className="teacher-table" role="table">
                <div className="teacher-table-head" role="row">
                  <span>Name</span>
                  <span>Mastery</span>
                  <span>Questions</span>
                  <span>Attempts</span>
                  <span>Last activity</span>
                </div>
                <div className="teacher-table-body">
                  {overview.students.map((student) => (
                    <button
                      key={student.student_id}
                      type="button"
                      className="teacher-table-row"
                      onClick={() => handleSelectStudent(student.student_id)}
                    >
                      <span>{student.name}</span>
                      <span>{student.overall_mastery}%</span>
                      <span>{formatCount(student.questions_answered)}</span>
                      <span>{formatCount(student.attempt_count)}</span>
                      <span>{formatLastActivity(student.last_activity_at)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card teacher-card">
            <div className="card-header">
              <div>
                <h2>Units</h2>
                <p className="muted small">
                  See where your class is spending time and who needs practice.
                </p>
              </div>
            </div>
            {overview.units.length === 0 ? (
              <p className="muted small">No unit activity yet.</p>
            ) : (
              <ul className="teacher-units">
                {overview.units.map((unit) => (
                  <li key={unit.unit_id}>
                    <div>
                      <strong>{unit.unit_name}</strong>
                      <p className="muted small">
                        {unit.student_count} students • {unit.attempt_count} attempts
                      </p>
                    </div>
                    <span className="unit-mastery-pill">{unit.average_mastery}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <StudentDetailDrawer
        studentId={selectedStudentId}
        detail={selectedStudentId ? studentDetails[selectedStudentId] : undefined}
        summary={activeSummary}
        onClose={closeDrawer}
        onRetry={fetchStudentDetail}
      />
    </div>
  );
}
