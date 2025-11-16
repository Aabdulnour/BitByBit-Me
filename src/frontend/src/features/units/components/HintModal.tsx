import React, { useEffect, useState } from "react";
import { getHintsForQuestion } from "../../../lib/hints";

export default function HintModal({
  questionId,
  open,
  onClose,
  onHintUsed,
}: {
  questionId: string;
  open: boolean;
  onClose: () => void;
  onHintUsed?: () => void;
}) {
  const [activeLevel, setActiveLevel] = useState<1 | 2 | 3 | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const hints = getHintsForQuestion(questionId);

  useEffect(() => {
    if (!open) {
      setActiveLevel(null);
      setRevealed(new Set());
    }
  }, [open, questionId]);

  if (!open) return null;

  const getHintText = (level: 1 | 2 | 3) => {
    if (level === 1) return hints.level1;
    if (level === 2) return hints.level2;
    return hints.level3;
  };

  const toggleLevel = (level: 1 | 2 | 3, locked: boolean) => {
    if (locked) return;
    setActiveLevel(level);
    setRevealed((prev) => {
      const next = new Set(prev);
      if (!next.has(level)) {
        onHintUsed?.();
      }
      next.add(level);
      return next;
    });
  };

  const selectedHint = activeLevel ? getHintText(activeLevel) : null;

  return (
    <div className="hint-overlay" role="dialog" aria-modal="true">
      <div className="hint-modal">
        <button className="hint-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>AI Tutor - Progressive hints</h3>
        <p className="muted small">
          Choose a hint level. Start with a gentle nudge and reveal more detail
          only if needed.
        </p>
        <div className="hint-levels">
          {[1, 2, 3].map((level) => {
            const hasHint = !!getHintText(level as 1 | 2 | 3);
            const locked =
              (level > 1 && !revealed.has(level - 1)) || !hasHint;
            return (
              <button
                key={level}
                className={`hint-level ${activeLevel === level ? "active" : ""}`}
                disabled={locked}
                onClick={() => toggleLevel(level as 1 | 2 | 3, locked)}
              >
                <span>Level {level}</span>
                <small className="muted">
                  {!hasHint
                    ? "Coming soon"
                    : level === 1
                    ? "Gentle nudge"
                    : level === 2
                    ? "Clearer direction"
                    : "Detailed guidance"}
                </small>
              </button>
            );
          })}
        </div>
        <div className="hint-content">
          {activeLevel ? (
            selectedHint ? (
              <p>{selectedHint}</p>
            ) : (
              <p className="muted small">That hint is coming soon.</p>
            )
          ) : (
            <p className="muted small">Select a level to reveal a hint.</p>
          )}
        </div>
        <div className="hint-actions">
          <button className="btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
