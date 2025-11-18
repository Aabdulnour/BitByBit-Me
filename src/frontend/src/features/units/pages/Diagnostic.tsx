import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import QuizRunner from "../components/QuizRunner";
import { UnitsAPI, type Quiz, type Unit } from "../services/unitsAPI";
import { useProgress } from "../hooks/useProgress";
import { createAttempt, rememberLearningLocation } from "../../../lib/studentClient";
import QuizIntro from "../components/QuizIntro";
import { classifyPlacement, describePlacement } from "../utils/progress";
import FeedbackCallout from "../components/FeedbackCallout";

export default function DiagnosticPage() {
  const { unitId } = useParams();
  const [unit, setUnit] = useState<Unit | undefined>();
  const [quiz, setQuiz] = useState<Quiz | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const nav = useNavigate();
  const { markDiagnosticTaken } = useProgress();

  useEffect(() => {
    (async () => {
      try {
        if (!unitId) return setError("Missing unit ID.");
        const u = await UnitsAPI.getUnit(unitId);
        if (!u) return setError("Unit not found.");
        setUnit(u);
        rememberLearningLocation({
          unitId: u.id,
          sectionId: null,
          activity: "diagnostic",
        }).catch(() => {});

        const q = await UnitsAPI.getQuiz(u.diagnosticQuizId);
        if (!q || q.questions.length === 0) {
          return setError("No diagnostic questions available.");
        }
        setQuiz(q);
      } catch (e) {
        setError("Could not load diagnostic. Please try again.");
      }
    })();
  }, [unitId]);

  useEffect(() => {
    setShowIntro(true);
    setFeedback(null);
  }, [unitId]);

  const renderSummaryDetail = (scorePct: number) => {
    const placement = classifyPlacement(scorePct);
    const description = describePlacement(placement);
    return (
      <>
        {feedback && <FeedbackCallout message={feedback} />}
        <div className="diagnostic-summary-extra">
          <p className="muted small">Placement</p>
          <h3>{placement || "Placement pending"}</h3>
          <p className="muted small">
            {description} This diagnostic simply places you — no need to pass it.
          </p>
        </div>
      </>
    );
  };

  if (error)
    return (
      <div className="page">
        <div className="empty">{error}</div>
      </div>
    );

  if (!unit || !quiz)
    return (
      <div className="page">
        <div className="empty">Loading diagnostic…</div>
      </div>
    );

  const passThreshold = quiz.passingScorePct ?? 60;

  if (showIntro) {
    return (
      <div className="page">
        <QuizIntro
          title={`Diagnostic test: ${unit.title}`}
          description="This quick assessment helps us understand your current skill level and pick the right starting point."
          bullets={[
            "5 questions covering key concepts",
            "Helps personalize your learning journey",
            "Takes only a few minutes",
          ]}
          primaryLabel="Start diagnostic"
          onStart={() => setShowIntro(false)}
          onBack={() => nav(`/units/${unit.id}`)}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="quiz-top-bar">
        <button className="btn" onClick={() => nav(`/units/${unit.id}`)}>
          ← Back
        </button>
        <div>
          <p className="muted small">{unit.title}</p>
          <h2 className="u-m-0">{quiz.title}</h2>
          <p className="muted small">Use this to set your placement.</p>
        </div>
        <button className="btn secondary" onClick={() => nav(`/units/${unit.id}`)}>
          Exit
        </button>
      </div>
      <QuizRunner
        title={quiz.title}
        questions={quiz.questions}
        passingScorePct={passThreshold}
        summaryPrimaryLabel="Back to unit detail"
        summarySecondaryLabel="Retry quiz"
        renderSummaryDetail={renderSummaryDetail}
        onFinished={async ({ scorePct, answers }) => {
          try {
            const result = await createAttempt({
              quizId: quiz.id,
              quizType: "diagnostic",
              unitId: unit.id,
              sectionId: null,
              scorePct,
              results: answers.map((a) => ({
                questionId: a.questionId,
                correct: a.correct,
                chosenAnswer: a.chosenAnswer,
                timeSec: 0,
                usedHint: a.usedHint,
              })),
            });
            markDiagnosticTaken(unit.id);
            setFeedback(result?.personalized_feedback ?? null);
          } catch (e) {
            console.error("Failed to record diagnostic attempt", e);
            setFeedback(null);
          }
        }}
        onExit={(scorePct) => {
          markDiagnosticTaken(unit.id);
          nav(`/units/${unit.id}`);
        }}
      />
    </div>
  );
}
