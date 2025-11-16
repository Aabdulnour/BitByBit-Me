import React from "react";
import type { Quiz } from "../../units/services/unitsAPI";
import type { AttemptRecord } from "../../../types/attempts";
import { formatAttemptDate, getQuizTypeLabel } from "../utils";

export default function AttemptRow({
  attempt,
  unitTitle,
  sectionTitle,
  quiz,
  onSelect,
}: {
  attempt: AttemptRecord;
  unitTitle: string;
  sectionTitle?: string;
  quiz?: Quiz;
  onSelect: () => void;
}) {
  const quizTitle = quiz?.title || quiz?.id || attempt.quizId;
  const quizTypeLabel = getQuizTypeLabel(attempt.quizType);
  const dateLabel = formatAttemptDate(attempt.createdAt);
  const passingScore = quiz?.passingScorePct ?? 60;
  const passed = attempt.scorePct >= passingScore;
  const statusLabel = passed ? "Passed" : "Review";
  const usedHints = Array.isArray(attempt.results)
    ? attempt.results.some((result) => Boolean(result?.usedHint))
    : false;

  return (
    <div className="history-row">
      <button className="history-row-main" onClick={onSelect}>
        <span>{dateLabel}</span>
        <span className="history-topic-cell">
          <strong>{unitTitle}</strong>
          {sectionTitle && <em className="muted small">{sectionTitle}</em>}
        </span>
        <span>{quizTitle}</span>
        <span
          className={`tag ${
            attempt.quizType === "diagnostic"
              ? "tag-blue"
              : attempt.quizType === "practice"
              ? "tag-green"
              : "tag-orange"
          }`}
        >
          {quizTypeLabel}
        </span>
        <span>
          <span className={`hint-pill ${usedHints ? "used" : ""}`}>
            {usedHints ? "Used" : "None"}
          </span>
        </span>
        <span className="history-score-cell">
          <span className={`tag ${passed ? "tag-pass" : "tag-fail"}`}>
            {attempt.scorePct}%
          </span>
          <small className="muted">{statusLabel}</small>
        </span>
        <span className="history-toggle">View</span>
      </button>
    </div>
  );
}
