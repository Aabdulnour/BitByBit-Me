import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchTeacherOverview,
  fetchTeacherStudentDetail,
  type TeacherOverviewSummary,
  type TeacherStudentSummary,
  type TeacherUnitSummary,
  type DifficultyInsight,
  type SkillMasterySnapshotEntry,
} from "../../../lib/teacherClient";
import { normalizeAttempts } from "../../../lib/attempts";
import StudentDetailDrawer, {
  type StudentDetailState,
} from "../components/StudentDetailDrawer";

const initialOverview = {
  summary: null,
  students: [],
  units: [],
  difficultyInsights: [],
  skillMasterySnapshot: [],
};

type OverviewState = {
  summary: TeacherOverviewSummary | null;
  students: TeacherStudentSummary[];
  units: TeacherUnitSummary[];
  difficultyInsights: DifficultyInsight[];
  skillMasterySnapshot: SkillMasterySnapshotEntry[];
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

function formatHintUsage(rate?: number | null) {
  if (rate == null) return "—";
  const pct = Math.round(rate * 100);
  if (pct >= 60) return `${pct}% • High`;
  if (pct >= 30) return `${pct}% • Medium`;
  return `${pct}% • Low`;
}

function formatPercent(rate?: number | null, fallback = "—") {
  if (rate == null) return fallback;
  return `${Math.round(rate * 100)}%`;
}

function formatSkillLabel(skillId: string) {
  return skillId
    .replace(/[_-]/g, " ")
    .replace(/:/g, " • ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function TeacherDashboard() {
  const [overview, setOverview] = useState<OverviewState>(initialOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<Record<string, StudentDetailState>>({});
  const [studentFilter, setStudentFilter] = useState("");
  const [sortOption, setSortOption] = useState<"name" | "mastery" | "activity">("name");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeacherOverview();
      setOverview({
        summary: data.summary ?? null,
        students: data.students,
        units: data.units,
        difficultyInsights: data.difficulty_insights ?? [],
        skillMasterySnapshot: data.skill_mastery_snapshot ?? [],
      });
    } catch (err) {
      console.error("Failed to load teacher overview", err);
      setError("We could not load the teacher overview right now.");
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

  const summaryStats = useMemo(() => {
    const summary =
      overview.summary ?? {
        total_students: overview.students.length,
        average_mastery: 0,
        total_attempts: 0,
        average_hint_usage: null,
      };
    return [
      {
        label: "Total students",
        value: formatCount(summary.total_students || 0),
        sublabel: "Enrolled in BitByBit",
      },
      {
        label: "Average mastery",
        value: `${Math.round(summary.average_mastery || 0)}%`,
        sublabel: "Class-wide mastery",
        helper:
          "Mastery is a score from 0 to 1 (shown as a percent) estimated from graded activities.",
      },
      {
        label: "Total attempts",
        value: formatCount(summary.total_attempts || 0),
        sublabel: "Across all quizzes",
      },
      {
        label: "Average hint usage",
        value:
          summary.average_hint_usage != null
            ? formatPercent(summary.average_hint_usage)
            : "Not enough data",
        sublabel: "Hints per attempt",
        helper:
          "Hint usage is the percentage of questions where students requested a hint.",
      },
    ];
  }, [overview.summary, overview.students.length]);

  const unitsNeedingAttention = useMemo(
    () =>
      overview.units
        .filter((unit) => (unit.average_mastery ?? 0) < 50)
        .sort(
          (a, b) =>
            (a.average_mastery ?? 0) - (b.average_mastery ?? 0)
        ),
    [overview.units]
  );

  const filteredStudents = useMemo(() => {
    const filter = studentFilter.trim().toLowerCase();
    let list = overview.students;
    if (filter) {
      list = list.filter((student) =>
        student.name.toLowerCase().includes(filter)
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortOption === "mastery") {
        return (b.overall_mastery || 0) - (a.overall_mastery || 0);
      }
      if (sortOption === "activity") {
        const aTime = a.last_activity_at ? Date.parse(a.last_activity_at) : 0;
        const bTime = b.last_activity_at ? Date.parse(b.last_activity_at) : 0;
        return bTime - aTime;
      }
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [overview.students, studentFilter, sortOption]);

  const hasStudents = overview.students.length > 0;

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

      {!loading && !error && summaryStats && (
        <div className="teacher-summary-grid">
          {summaryStats.map((card) => (
            <div key={card.label} className="teacher-summary-card">
              <p className="muted small">
                {card.label}{" "}
                {card.helper && (
                  <span className="helper-hint inline" title={card.helper}>
                    i
                  </span>
                )}
              </p>
              <strong className="teacher-summary-value">{card.value}</strong>
              <p className="muted small">{card.sublabel}</p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="card state-card">
          <p className="muted small">Loading class overview…</p>
        </div>
      )}

      {!loading &&
        !error &&
        (overview.skillMasterySnapshot.length > 0 ||
          overview.difficultyInsights.length > 0) && (
          <div className="teacher-grid">
            {overview.skillMasterySnapshot.length > 0 && (
              <div className="card teacher-card">
                <p className="muted small">Skill signals</p>
                <h3>Weakest skills right now</h3>
                <ul className="attention-list">
                  {overview.skillMasterySnapshot.slice(0, 4).map((skill) => (
                    <li key={skill.skill_id}>
                      <strong>{formatSkillLabel(skill.skill_id)}</strong>
                      <span>
                        {Math.round((skill.average_mastery ?? 0) * 100)}% mastery
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {overview.difficultyInsights.length > 0 && (
              <div className="card teacher-card">
                <p className="muted small">Hardest questions</p>
                <h3>Where students miss most</h3>
                <ul className="attention-list">
                  {overview.difficultyInsights.slice(0, 4).map((item) => (
                    <li key={item.question_id}>
                      <strong>{item.question_text}</strong>
                      <span>
                        {Math.round((item.difficulty ?? 0) * 100)}% difficulty
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      {!loading && error && (
        <div className="card state-card state-card-error">
          <p className="error-text">{error}</p>
          <button className="btn" onClick={loadOverview}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && !hasStudents && (
        <div className="card state-card">
          <p className="u-mb-4">No students enrolled yet.</p>
          <p className="muted small">
            Invite your first class to unlock mastery and hint usage analytics.
          </p>
        </div>
      )}

      {!loading && !error && (
        <div className="card attention-card">
            <div className="card-head">
              <div>
                <p className="muted small">Units that need attention</p>
                <h3 className="u-my-4">Below 50% mastery</h3>
              </div>
            </div>
          {unitsNeedingAttention.length === 0 ? (
            <p className="muted small">
              No units need special attention right now.
            </p>
          ) : (
            <ul className="attention-list">
              {unitsNeedingAttention.slice(0, 3).map((unit) => (
                <li key={unit.unit_id}>
                  <strong>{unit.unit_name}</strong>
                  <span>{Math.round(unit.average_mastery ?? 0)}% mastery</span>
                </li>
              ))}
            </ul>
          )}
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
            {!hasStudents ? (
              <p className="muted small">Add students to view their progress.</p>
            ) : (
              <>
                <div className="teacher-controls">
                  <label>
                    <span className="muted small">Filter</span>
                    <input
                      className="input"
                      type="text"
                      placeholder="Search students"
                      value={studentFilter}
                      onChange={(event) => setStudentFilter(event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="muted small">Sort by</span>
                    <select
                      className="input"
                      value={sortOption}
                      onChange={(event) =>
                        setSortOption(event.target.value as typeof sortOption)
                      }
                    >
                      <option value="name">Name (A-Z)</option>
                      <option value="mastery">Overall mastery</option>
                      <option value="activity">Last activity</option>
                    </select>
                  </label>
                </div>
                {filteredStudents.length === 0 ? (
                  <p className="muted small">
                    No students match that search. Try adjusting your filters.
                  </p>
                ) : (
                  <div className="teacher-table">
                    <div className="teacher-table-head">
                      <span>Name</span>
                      <span>
                        Mastery{" "}
                        <span
                          className="helper-hint inline"
                          title="Mastery is a score from 0 to 1 (shown as a percent) estimated from mini quizzes and unit tests."
                        >
                          i
                        </span>
                      </span>
                      <span>Questions</span>
                      <span>Attempts</span>
                      <span>
                        Hint usage{" "}
                        <span
                          className="helper-hint inline"
                          title="Hint usage is the percentage of questions where a hint was requested."
                        >
                          i
                        </span>
                      </span>
                      <span>Last activity</span>
                    </div>
                    <div className="teacher-table-body">
                      {filteredStudents.map((student) => (
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
                          <span>{formatHintUsage(student.hint_usage_rate)}</span>
                          <span>{formatLastActivity(student.last_activity_at)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
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
              <div className="teacher-unit-grid">
                {overview.units.map((unit) => {
                  const hintUsagePct =
                    unit.hint_usage_rate != null
                      ? Math.round(unit.hint_usage_rate * 100)
                      : null;
                  const highHintUsage = (unit.hint_usage_rate ?? 0) >= 0.5;
                  return (
                    <div key={unit.unit_id} className="teacher-unit-card">
                      <div className="teacher-unit-card-head">
                        <strong>{unit.unit_name}</strong>
                        <span className="unit-mastery-pill">{unit.average_mastery}%</span>
                      </div>
                      <p className="muted small">
                        {unit.student_count}{" "}
                        {unit.student_count === 1 ? "student" : "students"} engaged
                      </p>
                      <div className="teacher-unit-card-body">
                        <div>
                          <p className="muted tiny">Attempts</p>
                          <strong>{formatCount(unit.attempt_count)}</strong>
                          {unit.attempt_count === 0 && (
                            <span className="muted tiny helper-text">No attempts yet</span>
                          )}
                        </div>
                        <div>
                          <p className="muted tiny">
                            Hint usage{" "}
                            <span
                              className="helper-hint inline"
                              title="Hint usage is the percentage of questions where students requested a hint."
                            >
                              i
                            </span>
                          </p>
                          <strong>{hintUsagePct != null ? `${hintUsagePct}%` : "No data"}</strong>
                        </div>
                      </div>
                      {highHintUsage && (
                        <p className="muted small emphasis">
                          High hint usage flagged
                          {hintUsagePct != null ? ` (${hintUsagePct}% of attempts)` : ""}.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
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
