import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QuizRunner from "../components/QuizRunner";
import { UnitsAPI, type Quiz, type Unit } from "../services/unitsAPI";
import { createAttempt, rememberLearningLocation } from "../../../lib/studentClient";
import QuizIntro from "../components/QuizIntro";
import FeedbackCallout from "../components/FeedbackCallout";

export default function UnitTestPage() {
  const { unitId } = useParams();
  const [unit, setUnit] = useState<Unit | undefined>();
  const [quiz, setQuiz] = useState<Quiz | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const nav = useNavigate();

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
          activity: "unit_test",
        }).catch(() => {});

        const q = await UnitsAPI.getQuiz(u.comprehensiveQuizId);
        if (!q || q.questions.length === 0) {
          return setError("No unit test questions available.");
        }
        setQuiz(q);
      } catch (e) {
        setError("Could not load unit test. Please try again.");
      }
    })();
  }, [unitId]);

  useEffect(() => {
    setShowIntro(true);
    setFeedback(null);
  }, [unitId]);

  if (error)
    return (
      <div className="page">
        <div className="empty">{error}</div>
      </div>
    );
  if (!unit || !quiz)
    return (
      <div className="page">
        <div className="empty">Loading unit test…</div>
      </div>
    );

  const passThreshold = quiz.passingScorePct ?? 70;

  return (
    <div className="page">
      {showIntro ? (
        <QuizIntro
          title={`Unit test: ${unit.title}`}
          description="Show what you know across the entire unit. This score has the biggest impact on your mastery."
          bullets={[
            `${quiz.questions.length} comprehensive questions`,
            "Covers every section in this unit",
            "Plan for 10-15 minutes of focused time",
          ]}
          primaryLabel="Start unit test"
          onStart={() => setShowIntro(false)}
          onBack={() => nav(`/units/${unit.id}`)}
        />
      ) : (
        <>
          <div className="quiz-top-bar">
            <button className="btn" onClick={() => nav(`/units/${unit.id}`)}>
              ← Back
            </button>
            <div>
              <p className="muted small">{unit.title}</p>
              <h2 className="u-m-0">{quiz.title}</h2>
              <p className="muted small">Give yourself enough time to focus.</p>
            </div>
            <button className="btn secondary" onClick={() => nav(`/units/${unit.id}`)}>
              Exit test
            </button>
          </div>
          <QuizRunner
            title={quiz.title}
            questions={quiz.questions}
            passingScorePct={passThreshold}
            summaryPrimaryLabel="Back to unit"
            summarySecondaryLabel="Retry quiz"
            renderSummaryDetail={() =>
              feedback ? <FeedbackCallout message={feedback} /> : null
            }
            onFinished={async ({ scorePct, answers }) => {
              try {
                const result = await createAttempt({
                  quizId: quiz.id,
                  quizType: "unit_test",
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
                setFeedback(result?.personalized_feedback ?? null);
              } catch (e) {
                console.error("Failed to record unit test attempt", e);
                setFeedback(null);
              }
            }}
            onExit={() => nav(`/units/${unit.id}`)}
          />
        </>
      )}
    </div>
  );
}
