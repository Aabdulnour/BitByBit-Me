import React from "react";
import type { AssessmentResultEntry } from "../utils/assessment";

type Props = {
  entries?: AssessmentResultEntry[] | null;
};

export default function AssessmentSummaryTable({ entries }: Props) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (safeEntries.length === 0) {
    return <p className="muted small">No responses recorded.</p>;
  }

  return (
    <div className="assessment-summary-table">
      {safeEntries.map((entry, idx) => {
        const prompt =
          (typeof entry.prompt === "string" && entry.prompt.trim()) ||
          "Question details unavailable.";
        const yourAnswer =
          entry.selectedChoiceLabel ?? "(no answer recorded)";
        const correctAnswer =
          entry.correctChoiceLabel ?? "(correct answer unavailable)";
        const explanation =
          (typeof entry.explanation === "string" &&
            entry.explanation.trim()) ||
          "(no explanation provided)";

        return (
          <div
            key={`${entry.questionId}-${idx}`}
            className={`assessment-summary-row ${
              entry.isCorrect ? "correct" : "incorrect"
            }`}
          >
            <div className="assessment-summary-question">
              <p className="muted small">Question {idx + 1}</p>
              <p>{prompt}</p>
            </div>
            <div className="assessment-summary-answers">
              <p>
                <strong>Your answer:</strong> <span>{yourAnswer}</span>
              </p>
              <p>
                <strong>Correct answer:</strong> <span>{correctAnswer}</span>
              </p>
            </div>
            <p className="assessment-summary-explanation muted small">
              {explanation}
            </p>
          </div>
        );
      })}
    </div>
  );
}
