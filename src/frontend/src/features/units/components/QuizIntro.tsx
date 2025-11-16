import React from "react";

type QuizIntroProps = {
  title: string;
  description: string;
  bullets: string[];
  primaryLabel: string;
  onStart: () => void;
  onBack?: () => void;
};

export default function QuizIntro({
  title,
  description,
  bullets,
  primaryLabel,
  onStart,
  onBack,
}: QuizIntroProps) {
  return (
    <div className="quiz-intro">
      <div className="quiz-intro-card card">
        {onBack && (
          <button className="text-link back-link" onClick={onBack}>
            ← Back
          </button>
        )}
        <h2>{title}</h2>
        <p className="muted">{description}</p>
        <div className="quiz-intro-highlights">
          <ul>
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
        <button className="btn primary" onClick={onStart}>
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
