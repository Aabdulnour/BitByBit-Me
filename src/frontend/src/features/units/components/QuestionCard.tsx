import React, { useState } from "react";
import type { Question } from "../services/unitsAPI";
import HintModal from "./HintModal";

type Props = {
  q: Question;
  onSubmit: (val: string) => void;
  onHintUsed?: () => void;
  disabledOptions?: boolean;
  selectedAnswer?: string | null;
  submittingChoice?: string | null;
};

export default function QuestionCard({
  q,
  onSubmit,
  onHintUsed,
  disabledOptions = false,
  selectedAnswer = null,
  submittingChoice = null,
}: Props) {
  const [hintOpen, setHintOpen] = useState(false);

  const renderOptionButton = (label: string) => {
    const isSelected = selectedAnswer === label;
    const isSubmitting = submittingChoice === label;
    return (
      <button
        key={label}
        className={`btn option${isSelected ? " selected" : ""}`}
        onClick={() => onSubmit(label)}
        disabled={disabledOptions}
        aria-pressed={isSelected}
      >
        {isSubmitting ? "Submitting…" : label}
      </button>
    );
  };

  return (
    <div className="card q-card">
      <h3 className="q-prompt">{q.prompt}</h3>

      {q.type === "mcq" && (
        <div className="options">
          {q.options?.map((opt) => renderOptionButton(opt))}
        </div>
      )}

      {q.type === "boolean" && (
        <div className="options">
          {renderOptionButton("True")}
          {renderOptionButton("False")}
        </div>
      )}

      <div className="hint-trigger">
        <button className="btn secondary" onClick={() => setHintOpen(true)}>
          💡 Get hint
        </button>
      </div>
      <HintModal
        questionId={q.id}
        open={hintOpen}
        onClose={() => setHintOpen(false)}
        onHintUsed={onHintUsed}
      />
    </div>
  );
}
