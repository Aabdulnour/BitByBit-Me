import React from "react";
import type { AttemptRecord } from "../../../types/attempts";
import type { TeacherStudentSummary } from "../../../lib/teacherClient";

export type StudentDetailData = {
  student: {
    student_id: string;
    name: string;
    grade_level?: string;
    preferred_difficulty?: string;
    email?: string | null;
    skill_mastery?: Record<
      string,
      { p_mastery?: number; n_observations?: number; recent_correct?: number }
    >;
  };
  unitMastery: { unitId: string; unitName: string; mastery: number }[];
  attempts: AttemptRecord[];
};

export type StudentDetailState = {
  loading: boolean;
  error: string | null;
  data: StudentDetailData | null;
};

interface Props {
  studentId: string | null;
  detail: StudentDetailState | undefined;
  summary?: TeacherStudentSummary;
  onClose: () => void;
  onRetry?: (studentId: string) => void;
}

function formatAttemptDate(
  createdAt?: number | string | null
) {
  if (!createdAt) return "—";
  if (typeof createdAt === "string") {
    const date = new Date(createdAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  const stamp =
    typeof createdAt === "number" ? createdAt * 1000 : Date.now();
  const date = new Date(stamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatQuizLabel(quizType?: string) {
  if (!quizType) return "Unknown";
  switch (quizType) {
    case "mini_quiz":
      return "Mini quiz";
    case "unit_test":
      return "Unit test";
    case "diagnostic":
      return "Diagnostic";
    case "practice":
      return "Practice";
    default:
      return quizType.replace("_", " ");
  }
}

function formatSkillLabel(skillId: string) {
  return skillId
    .replace(/[_-]/g, " ")
    .replace(/:/g, " • ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function StudentDetailDrawer({
  studentId,
  detail,
  summary,
  onClose,
  onRetry,
}: Props) {
  if (!studentId) return null;
  const contentState = detail || { loading: true, error: null, data: null };
  const unitMastery = contentState.data?.unitMastery ?? [];
  const attemptList = contentState.data?.attempts ?? [];
  const skillEntries = Object.entries(
    contentState.data?.student.skill_mastery ?? {}
  )
    .map(([skillId, entry]) => ({
      skillId,
      mastery: Math.round((entry?.p_mastery ?? 0) * 100),
      observations: entry?.n_observations ?? 0,
    }))
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 6);
  const stats = [
    {
      label: "Overall mastery",
      value: `${summary?.overall_mastery ?? 0}%`,
      helper:
        "Mastery is a score from 0 to 1 (shown as a percent) estimated from recent mini quizzes and unit tests.",
    },
    {
      label: "Questions answered",
      value: `${summary?.questions_answered ?? 0}`,
    },
    {
      label: "Attempts",
      value: `${summary?.attempt_count ?? attemptList.length}`,
    },
    {
      label: "Hint usage",
      value:
        summary?.hint_usage_rate != null
          ? `${Math.round((summary.hint_usage_rate || 0) * 100)}%`
          : "—",
      helper:
        "Hint usage is the percentage of questions where the student requested a hint.",
    },
  ];
  return (
    <div className="student-detail-layer" role="dialog" aria-modal="true">
      <div className="student-detail-backdrop" onClick={onClose} />
      <div className="student-detail-card">
        <div className="teacher-detail">
          <div className="teacher-student-detail">
            <div className="teacher-student-detail-header">
              <div className="student-detail-header">
                <div>
                  <p className="muted small">Student profile</p>
                  <h2>{contentState.data?.student.name || "Loading…"}</h2>
                  {summary?.last_activity_at && (
                    <p className="muted small">
                      Last activity: {formatAttemptDate(summary.last_activity_at)}
                    </p>
                  )}
                </div>
                <div className="student-detail-meta">
                  <span>{contentState.data?.student.email || "No email on file"}</span>
                </div>
              </div>
              <button
                className="student-detail-close"
                type="button"
                onClick={onClose}
                aria-label="Close student detail"
              >
                Close ✕
              </button>
            </div>

            <div className="teacher-student-detail-body">
              {contentState.loading && (
                <div className="drawer-section">
                  <p className="muted small">Gathering latest attempts…</p>
                </div>
              )}
              {contentState.error && (
                <div className="drawer-section">
                  <p className="error-text">{contentState.error}</p>
                  {onRetry && (
                    <button className="btn" onClick={() => onRetry(studentId)}>
                      Retry
                    </button>
                  )}
                </div>
              )}
              {!contentState.loading && !contentState.error && contentState.data && (
                <>
                  <div className="drawer-section">
                    <div className="drawer-stat-grid">
                      {stats.map((stat) => (
                        <div key={stat.label} className="drawer-stat">
                          <p className="muted small">
                            {stat.label}{" "}
                            {stat.helper && (
                              <span
                                className="helper-hint inline"
                                title={stat.helper}
                              >
                                i
                              </span>
                            )}
                          </p>
                          <strong>{stat.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="drawer-section">
                    <h4>
                      Unit mastery{" "}
                      <span
                        className="helper-hint inline"
                        title="Mastery is a score from 0 to 1 (shown as a percent) estimated from the student's graded attempts."
                      >
                        i
                      </span>
                    </h4>
                    {unitMastery.length === 0 && (
                      <p className="muted small">No mastery data yet for this student.</p>
                    )}
                    <ul className="unit-mastery-list">
                      {unitMastery.map((unit) => {
                        const struggling = unit.mastery < 50;
                        const strong = unit.mastery >= 80;
                        let chipLabel: string | null = null;
                        let chipClass = "mastery-chip";
                        if (struggling) {
                          chipLabel = "struggling";
                          chipClass += " weak";
                        } else if (strong) {
                          chipLabel = "strong";
                          chipClass += " strong";
                        }
                        return (
                          <li key={unit.unitId}>
                            <div>
                              <strong>{unit.unitName}</strong>
                              <div className="unit-mastery-meta">
                                <span className="muted small">{unit.mastery}% mastery</span>
                                {chipLabel && (
                                  <span className={chipClass}>{chipLabel}</span>
                                )}
                              </div>
                            </div>
                            <div className="unit-mastery-bar">
                              <progress
                                className="progress-bar progress-bar-compact"
                                max={100}
                                value={unit.mastery}
                                aria-valuenow={unit.mastery}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="drawer-section">
                    <h4>Skill mastery signals</h4>
                    {skillEntries.length === 0 && (
                      <p className="muted small">
                        No skill-level mastery signals yet for this student.
                      </p>
                    )}
                    {skillEntries.length > 0 && (
                      <ul className="unit-mastery-list">
                        {skillEntries.map((skill) => (
                          <li key={skill.skillId}>
                            <div>
                              <strong>{formatSkillLabel(skill.skillId)}</strong>
                              <div className="unit-mastery-meta">
                                <span className="muted small">
                                  {skill.mastery}% mastery • {skill.observations} observations
                                </span>
                              </div>
                            </div>
                            <div className="unit-mastery-bar">
                              <progress
                                className="progress-bar progress-bar-compact"
                                max={100}
                                value={skill.mastery}
                                aria-valuenow={skill.mastery}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="drawer-section">
                    <h4>Recent attempts</h4>
                    <ul className="drawer-attempts">
                      {attemptList.slice(0, 4).map((attempt) => (
                        <li key={attempt.id}>
                          <div>
                            <strong>{formatQuizLabel(attempt.quizType)}</strong>
                            <p className="muted small">
                              {attempt.unitId || "Unknown unit"} • {formatAttemptDate(attempt.createdAt)}
                            </p>
                          </div>
                          <span className="attempt-score">{attempt.scorePct}%</span>
                        </li>
                      ))}
                      {attemptList.length === 0 && (
                        <li>
                          <p className="muted small">No attempts found yet.</p>
                        </li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
