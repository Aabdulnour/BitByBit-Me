import React, { useState } from "react";
import type { Question } from "../services/unitsAPI";
import HintModal from "./HintModal";

export default function QuestionCard({
  q,
  onSubmit,
  onHintUsed,
}: {
  q: Question;
  onSubmit: (val: string) => void;
  onHintUsed?: () => void;
}) {
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <div className="card q-card">
      <h3 className="q-prompt">{q.prompt}</h3>

      {q.type === "mcq" && (
        <div className="options">
          {q.options?.map((opt) => (
            <button
              key={opt}
              className="btn option"
              onClick={() => onSubmit(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {q.type === "boolean" && (
        <div className="options">
          <button className="btn option" onClick={() => onSubmit("True")}>
            True
          </button>
          <button className="btn option" onClick={() => onSubmit("False")}>
            False
          </button>
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
