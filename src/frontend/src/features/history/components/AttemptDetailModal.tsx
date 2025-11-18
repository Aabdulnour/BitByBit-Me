import React, { useMemo } from "react";
import type { AttemptRecord } from "../../../types/attempts";
import type { Quiz } from "../../units/services/unitsAPI";
import { formatAttemptDate, getQuizTypeLabel } from "../utils";

type Props = {
  attempt: AttemptRecord;
  unitTitle: string;
  sectionTitle?: string;
  quiz?: Quiz;
  onClose: () => void;
};

export default function AttemptDetailModal({
  attempt,
  unitTitle,
  sectionTitle,
  quiz,
  onClose,
}: Props) {
  const quizTitle = quiz?.title || quiz?.id || attempt.quizId;
  const quizTypeLabel = getQuizTypeLabel(attempt.quizType);
  const dateLabel = formatAttemptDate(attempt.createdAt);
  const passingScore = quiz?.passingScorePct ?? 60;
  const passed = attempt.scorePct >= passingScore;

  const questionDetails = useMemo(() => {
    if (!Array.isArray(attempt.results)) return [];
    return attempt.results.map((result, idx) => {
      const question = quiz?.questions.find((q) => q.id === result?.questionId);
      return {
        id: result?.questionId || `${attempt.id}-${idx}`,
        prompt: question?.prompt || `Question ${idx + 1}`,
        correctAnswer: question?.answer || "Unknown",
        chosenAnswer: result?.chosenAnswer || "—",
        correct: Boolean(result?.correct),
        usedHint: Boolean(result?.usedHint),
      };
    });
  }, [attempt, quiz]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="attempt-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="attempt-modal-header">
          <div>
            <p className="muted small">
              {unitTitle}
              {sectionTitle ? ` • ${sectionTitle}` : ""}
            </p>
            <h2 className="u-my-4">{quizTitle}</h2>
            <p className="muted small">
              {quizTypeLabel} • {dateLabel}
            </p>
          </div>
          <div className="attempt-score">
            <span className={`tag ${passed ? "tag-pass" : "tag-fail"}`}>
              {attempt.scorePct}%
            </span>
            <small className="muted">{passed ? "Passed" : "Review"}</small>
          </div>
        </div>

        <div className="attempt-summary-grid">
          <div>
            <p className="muted small">Questions answered</p>
            <strong>{attempt.results.length}</strong>
          </div>
          <div>
            <p className="muted small">Quiz type</p>
            <strong>{quizTypeLabel}</strong>
          </div>
          <div>
            <p className="muted small">Section</p>
            <strong>{sectionTitle || "—"}</strong>
          </div>
        </div>

        <div className="attempt-detail-list">
          {questionDetails.map((detail, idx) => (
            <div key={detail.id} className="attempt-detail-row">
              <div>
                <p className="detail-prompt">
                  {idx + 1}. {detail.prompt}
                </p>
                <p className="detail-meta">
                  Correct: <strong>{detail.correctAnswer}</strong> • Your answer:{" "}
                  <strong>{detail.chosenAnswer}</strong>
                </p>
              </div>
              <div className="attempt-detail-flags">
                {detail.usedHint && (
                  <span className="hint-flag">Hint used</span>
                )}
                <span className={`tag ${detail.correct ? "tag-pass" : "tag-fail"}`}>
                  {detail.correct ? "Correct" : "Incorrect"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
