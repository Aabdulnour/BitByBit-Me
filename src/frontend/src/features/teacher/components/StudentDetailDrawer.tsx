import React from "react";
import type { AttemptRecord } from "../../../types/attempts";
import type { TeacherStudentSummary } from "../../../lib/teacherClient";

export type StudentDetailData = {
  student: {
    student_id: string;
    name: string;
    grade_level?: string;
    preferred_difficulty?: string;
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

function formatAttemptDate(createdAt?: number) {
  if (!createdAt) return "—";
  const date = new Date(createdAt * 1000);
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

export default function StudentDetailDrawer({
  studentId,
  detail,
  summary,
  onClose,
  onRetry,
}: Props) {
  if (!studentId) return null;
  const contentState = detail || { loading: true, error: null, data: null };

  return (
    <>
      <div className="student-detail-overlay" onClick={onClose} />
      <div className="student-detail-drawer">
        <div className="drawer-header">
          <div>
            <p className="muted small">Student focus</p>
            <h3>{contentState.data?.student.name || "Loading"}</h3>
          </div>
          <button className="btn-link" onClick={onClose} aria-label="Close detail">
            Close
          </button>
        </div>
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
              <div className="drawer-pill">
                <span>Overall mastery</span>
                <strong>{summary?.overall_mastery ?? 0}%</strong>
              </div>
              <p className="muted small">
                Grade {contentState.data.student.grade_level || "—"} • Prefers {" "}
                {contentState.data.student.preferred_difficulty || "medium"}
              </p>
            </div>
            <div className="drawer-section">
              <h4>Unit mastery</h4>
              {contentState.data.unitMastery.length === 0 && (
                <p className="muted small">No mastery data yet for this student.</p>
              )}
              <ul className="unit-mastery-list">
                {contentState.data.unitMastery.map((unit) => (
                  <li key={unit.unitId}>
                    <div>
                      <strong>{unit.unitName}</strong>
                      <span className="muted small">{unit.mastery}% mastery</span>
                    </div>
                    <div className="unit-mastery-bar">
                      <span style={{ width: `${unit.mastery}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="drawer-section">
              <h4>Recent attempts</h4>
              <ul className="drawer-attempts">
                {contentState.data.attempts.slice(0, 3).map((attempt) => (
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
                {contentState.data.attempts.length === 0 && (
                  <li>
                    <p className="muted small">No attempts found yet.</p>
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}
