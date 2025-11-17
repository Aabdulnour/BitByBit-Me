import React, { useState } from "react";
import QuestionCard from "./QuestionCard";
import SummaryCard from "./SummaryCard";
import type { Question } from "../services/unitsAPI";

type AnswerRecord = {
  questionId: string;
  correct: boolean;
  chosenAnswer: string;
  usedHint?: boolean;
};

export default function QuizRunner({
  title,
  questions,
  passingScorePct = 60,
  onExit,
  onFinished,
  summaryPrimaryLabel,
  summarySecondaryLabel,
  renderSummaryDetail,
}: {
  title: string;
  questions: Question[];
  passingScorePct?: number;
  onExit: (scorePct: number) => void;
  onFinished?: (payload: {
    correct: number;
    total: number;
    scorePct: number;
    answers: AnswerRecord[];
  }) => void;
  summaryPrimaryLabel?: string;
  summarySecondaryLabel?: string;
  renderSummaryDetail?: (scorePct: number) => React.ReactNode;
}) {
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [justAnswered, setJustAnswered] = useState<"correct" | "wrong" | null>(
    null
  );
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [finalScorePct, setFinalScorePct] = useState<number | null>(null);
  const [hintUsed, setHintUsed] = useState(false);

  const total = questions.length;
  const q = questions[i];

  function submit(ans: string) {
    const ok = String(ans).trim() === String(q.answer).trim();
    setJustAnswered(ok ? "correct" : "wrong");

    const answerRecord: AnswerRecord = {
      questionId: q.id,
      correct: ok,
      chosenAnswer: ans,
      usedHint: hintUsed,
    };

    setAnswers((prev) => [...prev, answerRecord]);

    setTimeout(() => {
      if (ok) setCorrect((c) => c + 1);

      if (i + 1 < questions.length) {
        setI(i + 1);
        setJustAnswered(null);
        setHintUsed(false);
      } else {
        const finalCorrect = ok ? correct + 1 : correct;
        const scorePct =
          total > 0 ? Math.round((finalCorrect / total) * 100) : 0;

        const payload = {
          correct: finalCorrect,
          total,
          scorePct,
          answers: [...answers, answerRecord],
        };

        setFinalScorePct(scorePct);
        setFinished(true);
        setHintUsed(false);
        if (onFinished) onFinished(payload);
      }
    }, 280);
  }

  if (finished) {
    const scorePct =
      finalScorePct ?? (total > 0 ? Math.round((correct / total) * 100) : 0);
    const passed = scorePct >= passingScorePct;
    const detail = renderSummaryDetail
      ? renderSummaryDetail(scorePct)
      : null;

    return (
      <SummaryCard
        title={title}
        scorePct={scorePct}
        passed={passed}
        primaryLabel={summaryPrimaryLabel}
        secondaryLabel={summarySecondaryLabel}
        detail={detail}
        onSecondary={() => {
          setI(0);
          setCorrect(0);
          setJustAnswered(null);
          setFinished(false);
          setAnswers([]);
          setFinalScorePct(null);
          setHintUsed(false);
        }}
        onPrimary={() => onExit(scorePct)}
      />
    );
  }

  return (
    <div className="quiz">
      <div className="quiz-header" role="status" aria-live="polite">
        <div className="progress">
          Question {i + 1} / {total}
        </div>
        {justAnswered && (
          <span className={`pill ${justAnswered}`}>
            {justAnswered === "correct" ? "Correct" : "Try again"}
          </span>
        )}
      </div>
      <QuestionCard
        q={q}
        onSubmit={submit}
        onHintUsed={() => setHintUsed(true)}
      />
    </div>
  );
}
