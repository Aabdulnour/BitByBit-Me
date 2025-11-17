import React from 'react';

export default function SummaryCard({
  title,
  scorePct,
  passed,
  onPrimary,
  onSecondary,
  primaryLabel = "Back to unit",
  secondaryLabel = "Retry quiz",
  detail,
}: {
  title: string;
  scorePct: number;
  passed: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  detail?: React.ReactNode;
}) {
  const message = passed ? "You passed! Keep up the momentum." : "Keep practicing and try again.";

  return (
    <div className="card summary" role="region" aria-label="Quiz summary">
      <div className="summary-head">
        <div>
          <p className="muted small">Quiz complete</p>
          <h3 className="summary-title">{title}</h3>
        </div>
        <div className={`summary-chip ${passed ? "pass" : "fail"}`}>
          {passed ? "Passed" : "Keep practicing"}
        </div>
      </div>
      <p className="summary-score">
        <span>{scorePct}%</span> score
      </p>
      <p className="summary-message">{message}</p>
      {detail && <div className="summary-detail">{detail}</div>}
      <div className="summary-actions">
        {onSecondary && (
          <button className="btn secondary" onClick={onSecondary} aria-label={secondaryLabel}>
            {secondaryLabel}
          </button>
        )}
        <button className="btn primary" onClick={onPrimary} aria-label={primaryLabel}>
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
