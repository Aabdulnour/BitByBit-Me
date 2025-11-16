import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import QuizRunner from "../components/QuizRunner";
import { UnitsAPI, type Quiz, type Unit } from "../services/unitsAPI";
import { createAttempt, rememberLearningLocation } from "../../../lib/studentClient";
import QuizIntro from "../components/QuizIntro";

export default function MiniQuizPage() {
  const { unitId, sectionId } = useParams();
  const nav = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!unitId || !sectionId) {
          setError("Missing unit or section id.");
          return;
        }
        const u = await UnitsAPI.getUnit(unitId);
        if (!u) {
          setError("Unit not found.");
          return;
        }
        const section = u.sections.find((s) => s.id === sectionId);
        if (!section || !section.miniQuizId) {
          setError("Mini quiz not available for this section.");
          return;
        }
        const q = await UnitsAPI.getQuiz(section.miniQuizId);
        if (!q || q.questions.length === 0) {
          setError("Mini quiz is empty.");
          return;
        }
        if (cancelled) return;
        setUnit(u);
        setQuiz(q);
        rememberLearningLocation({
          unitId: u.id,
          sectionId,
          activity: "mini_quiz",
        }).catch(() => {});
      } catch (err) {
        console.error("Failed to load mini quiz", err);
        if (!cancelled) setError("Unable to load mini quiz.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId, sectionId]);

  useEffect(() => {
    setShowIntro(true);
  }, [unitId, sectionId]);

  if (loading) {
    return (
      <div className="page">
        <div className="empty">Loading mini quiz…</div>
      </div>
    );
  }

  if (error || !unit || !quiz) {
    return (
      <div className="page">
        <div className="empty">{error || "Mini quiz not available."}</div>
      </div>
    );
  }

  const cleanedTitle = quiz.title.replace(/^mini quiz[:\-\s]*/i, "").trim();
  const heading = cleanedTitle ? `Mini quiz: ${cleanedTitle}` : "Mini quiz";

  return (
    <div className="page">
      {showIntro ? (
        <QuizIntro
          title={heading}
          description="Check your understanding before moving on. These short quizzes influence your mastery."
          bullets={[
            `${quiz.questions.length} focused questions`,
            "Earn mastery credit for this section",
            "Get instant feedback and explanations",
          ]}
          primaryLabel="Start mini quiz"
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
              <h2 style={{ margin: 0 }}>{heading}</h2>
              {cleanedTitle && (
                <p className="muted small">{cleanedTitle}</p>
              )}
            </div>
            <button
              className="btn secondary"
              onClick={() => nav(`/units/${unit.id}`)}
            >
              Exit quiz
            </button>
          </div>
          <QuizRunner
            title={quiz.title}
            questions={quiz.questions}
            summaryPrimaryLabel="Back to unit"
            summarySecondaryLabel="Retry quiz"
            onFinished={async ({ scorePct, answers }) => {
              try {
                await createAttempt({
                  quizId: quiz.id,
                  quizType: "mini_quiz",
                  unitId: unit.id,
                  sectionId: sectionId ?? null,
                  scorePct,
                  results: answers.map((a) => ({
                    questionId: a.questionId,
                    correct: a.correct,
                    chosenAnswer: a.chosenAnswer,
                    timeSec: 0,
                    usedHint: a.usedHint,
                  })),
                });
              } catch (err) {
                console.error("Could not record mini quiz attempt", err);
              }
            }}
            onExit={() => nav(`/units/${unit.id}`)}
          />
        </>
      )}
    </div>
  );
}
