import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UnitsAPI, type Quiz, type Unit } from "../services/unitsAPI";
import { createAttempt, rememberLearningLocation } from "../../../lib/studentClient";
import QuizIntro from "../components/QuizIntro";
import FeedbackCallout from "../components/FeedbackCallout";
import QuestionCard from "../components/QuestionCard";
import AssessmentSummaryTable from "../components/AssessmentSummaryTable";
import {
  buildAttemptResults,
  buildResultEntry,
  calcScorePct,
  type AssessmentResultEntry,
} from "../utils/assessment";

export default function MiniQuizPage() {
  const { unitId, sectionId } = useParams();
  const nav = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [results, setResults] = useState<AssessmentResultEntry[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [finalScorePct, setFinalScorePct] = useState<number | null>(null);
  const [savingAttempt, setSavingAttempt] = useState(false);

  const resetInteraction = () => {
    setSelectedAnswer(null);
    setHasSubmitted(false);
    setHintUsed(false);
  };

  const resetQuizState = (clearFeedback = false) => {
    setCurrentIndex(0);
    setResults([]);
    setIsComplete(false);
    setFinalScorePct(null);
    resetInteraction();
    if (clearFeedback) {
      setFeedback(null);
    }
  };

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
    resetQuizState(true);
  }, [unitId, sectionId]);

  const correctCount = useMemo(
    () => results.filter((entry) => entry.isCorrect).length,
    [results]
  );

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

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const totalQuestions = questions.length;
  const hasQuestions = totalQuestions > 0;
  const hasQuestionAtIndex =
    hasQuestions && currentIndex >= 0 && currentIndex < totalQuestions;
  const currentQuestion = hasQuestionAtIndex ? questions[currentIndex] : null;
  const isLastQuestion = hasQuestions
    ? currentIndex >= totalQuestions - 1
    : true;
  const denominator = totalQuestions || results.length || 0;
  const scorePct = finalScorePct ?? calcScorePct(results, denominator);

  const handleAnswerSelection = (choice: string) => {
    if (!currentQuestion || hasSubmitted || isComplete) return;
    setSelectedAnswer(choice);
    const entry = buildResultEntry(currentQuestion, choice, hintUsed);
    setResults((prev) => {
      const alreadyAnswered = prev.some(
        (item) => item.questionId === currentQuestion.id
      );
      if (alreadyAnswered) return prev;
      return [...prev, entry];
    });
    setHasSubmitted(true);
  };

  const finishQuiz = async () => {
    if (!unit || !quiz || isComplete) return;
    if (!results.length && totalQuestions > 0) return;
    const computedScore = calcScorePct(results, denominator);
    setFinalScorePct(computedScore);
    setIsComplete(true);
    setSavingAttempt(true);
    try {
      const attempt = await createAttempt({
        quizId: quiz.id,
        quizType: "mini_quiz",
        unitId: unit.id,
        sectionId: sectionId ?? null,
        scorePct: computedScore,
        results: buildAttemptResults(results),
      });
      setFeedback(attempt?.personalized_feedback ?? null);
    } catch (err) {
      console.error("Could not record mini quiz attempt", err);
      setFeedback(null);
    } finally {
      setSavingAttempt(false);
    }
  };

  const handleNextQuestion = () => {
    if (!hasSubmitted || !currentQuestion) return;
    if (isLastQuestion) {
      void finishQuiz();
      return;
    }
    setCurrentIndex((idx) => idx + 1);
    resetInteraction();
  };

  const handleStart = () => {
    resetQuizState(true);
    setShowIntro(false);
  };

  const handleRetry = () => {
    resetQuizState(true);
    setShowIntro(false);
  };

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
            "Review every explanation at the end",
          ]}
          primaryLabel="Start mini quiz"
          onStart={handleStart}
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
              <h2 className="u-m-0">{heading}</h2>
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
          {isComplete ? (
            <div className="card assessment-summary">
              <div className="assessment-summary-head">
                <div>
                  <p className="muted small">Mini quiz complete</p>
                  <h3 className="summary-title">{heading}</h3>
                  <p className="muted small">
                    {denominator > 0 ? (
                      <>
                        You answered {correctCount} of {denominator} questions
                        correctly ({scorePct}%).
                      </>
                    ) : (
                      "No questions were available for this quiz."
                    )}
                  </p>
                </div>
                <div className="assessment-score-pill">
                  <span>{scorePct}%</span>
                  <p className="muted small">Score</p>
                </div>
              </div>
              <p className="assessment-summary-copy">
                Use the explanations below to lock in the concepts before
                moving on.
              </p>
              <AssessmentSummaryTable entries={results} />
              {feedback && <FeedbackCallout message={feedback} />}
              {savingAttempt && (
                <p className="muted small">Saving your results…</p>
              )}
              <div className="assessment-summary-actions">
                <button
                  className="btn secondary"
                  onClick={handleRetry}
                  disabled={savingAttempt}
                >
                  Retry quiz
                </button>
                <button
                  className="btn primary"
                  onClick={() => nav(`/units/${unit.id}`)}
                >
                  Back to unit
                </button>
              </div>
            </div>
          ) : currentQuestion ? (
            <div className="card assessment-runner">
              <div className="assessment-runner-status">
                <p className="muted small">
                  Question {currentIndex + 1} of {totalQuestions}
                </p>
                {hasSubmitted && <span className="pill info">Answer recorded</span>}
              </div>
              <QuestionCard
                q={currentQuestion}
                onSubmit={handleAnswerSelection}
                onHintUsed={() => setHintUsed(true)}
                disabledOptions={hasSubmitted}
                selectedAnswer={selectedAnswer}
              />
              <div className="assessment-runner-footer">
                {hasSubmitted ? (
                  <>
                    <p className="muted small">
                      We will reveal the correct answers in your summary.
                    </p>
                    <button
                      className="btn primary"
                      onClick={handleNextQuestion}
                    >
                      {isLastQuestion ? "View summary" : "Next question"}
                    </button>
                  </>
                ) : (
                  <p className="muted small">
                    Select an answer to lock it in.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="empty small">
              No questions are available for this mini quiz right now.
            </div>
          )}
        </>
      )}
    </div>
  );
}
