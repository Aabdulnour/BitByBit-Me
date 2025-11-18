import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  describeComprehensiveRecommendation,
  type AssessmentResultEntry,
} from "../utils/assessment";

export default function UnitTestPage() {
  const { unitId } = useParams();
  const [unit, setUnit] = useState<Unit | undefined>();
  const [quiz, setQuiz] = useState<Quiz | undefined>();
  const [error, setError] = useState<string | null>(null);
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
  const nav = useNavigate();

  const resetInteraction = () => {
    setSelectedAnswer(null);
    setHasSubmitted(false);
    setHintUsed(false);
  };

  const resetTestState = (clearFeedback = false) => {
    setResults([]);
    setCurrentIndex(0);
    setIsComplete(false);
    setFinalScorePct(null);
    resetInteraction();
    if (clearFeedback) {
      setFeedback(null);
    }
  };

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
    resetTestState(true);
  }, [unitId]);

  const correctCount = useMemo(
    () => results.filter((entry) => entry.isCorrect).length,
    [results]
  );

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

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const totalQuestions = questions.length;
  const hasQuestions = totalQuestions > 0;
  const hasQuestionAtIndex =
    hasQuestions && currentIndex >= 0 && currentIndex < totalQuestions;
  const currentQuestion = hasQuestionAtIndex ? questions[currentIndex] : null;
  const isLastQuestion = hasQuestions
    ? currentIndex >= totalQuestions - 1
    : true;
  const passThreshold = quiz.passingScorePct ?? 70;
  const denominator = totalQuestions || results.length || 0;
  const scorePct = finalScorePct ?? calcScorePct(results, denominator);
  const recommendation = describeComprehensiveRecommendation(scorePct);

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

  const finishTest = async () => {
    if (!unit || !quiz || isComplete) return;
    if (!results.length && totalQuestions > 0) return;
    const computedScore = calcScorePct(results, denominator);
    setFinalScorePct(computedScore);
    setIsComplete(true);
    setSavingAttempt(true);
    try {
      const attempt = await createAttempt({
        quizId: quiz.id,
        quizType: "unit_test",
        unitId: unit.id,
        sectionId: null,
        scorePct: computedScore,
        results: buildAttemptResults(results),
      });
      setFeedback(attempt?.personalized_feedback ?? null);
    } catch (e) {
      console.error("Failed to record unit test attempt", e);
      setFeedback(null);
    } finally {
      setSavingAttempt(false);
    }
  };

  const handleNextQuestion = () => {
    if (!hasSubmitted || !currentQuestion) return;
    if (isLastQuestion) {
      void finishTest();
      return;
    }
    setCurrentIndex((idx) => idx + 1);
    resetInteraction();
  };

  const handleStart = () => {
    resetTestState(true);
    setShowIntro(false);
  };

  const handleRetry = () => {
    resetTestState(true);
    setShowIntro(false);
  };

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
              <h2 className="u-m-0">{quiz.title}</h2>
              <p className="muted small">Give yourself enough time to focus.</p>
            </div>
            <button className="btn secondary" onClick={() => nav(`/units/${unit.id}`)}>
              Exit test
            </button>
          </div>
          {isComplete ? (
            <div className="card assessment-summary">
              <div className="assessment-summary-head">
                <div>
                  <p className="muted small">Unit test complete</p>
                  <h3 className="summary-title">{quiz.title}</h3>
                  <p className="muted small">
                    {denominator > 0 ? (
                      <>
                        You scored {correctCount} out of {denominator} questions
                        ({scorePct}%).
                      </>
                    ) : (
                      "No questions were available for this unit test."
                    )}
                  </p>
                </div>
                <div
                  className={`assessment-score-pill ${
                    scorePct >= passThreshold ? "pass" : "warn"
                  }`}
                >
                  <span>{scorePct}%</span>
                  <p className="muted small">Score</p>
                </div>
              </div>
              <p className="assessment-summary-copy">
                {denominator > 0
                  ? `You scored ${scorePct}% on the comprehensive test for ${unit.title}.`
                  : "We could not load any questions for this test, so no score was recorded."}
              </p>
              {denominator > 0 && (
                <div className="assessment-recommendation">
                  <p className="muted small">Recommendation</p>
                  <p>{recommendation}</p>
                </div>
              )}
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
                  Retry test
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
                {hasSubmitted && (
                  <span className="pill info">Answer recorded</span>
                )}
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
                      We will review every solution together once you finish.
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
              No questions are available for this unit test right now.
            </div>
          )}
        </>
      )}
    </div>
  );
}
