import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UnitsAPI, type Unit } from "../services/unitsAPI";
import { fetchDiagnosticResults } from "../../../lib/studentClient";

type ReviewSummary = {
  total: number;
  correct: number;
  percent: number;
};

type ReviewQuestion = {
  id: string;
  text: string;
  studentAnswer?: string | null;
  correctAnswer?: string | null;
  isCorrect: boolean;
  difficultyLabel?: string | null;
  difficultyScore?: number | null;
};

type ReviewPayload = {
  hasAttempt: boolean;
  summary: ReviewSummary;
  quizTitle?: string;
  questions: ReviewQuestion[];
  personalizedFeedback?: string | null;
};

function mapApiResponse(raw: any): ReviewPayload {
  const summary = raw?.summary || {};
  const questions = Array.isArray(raw?.questions) ? raw.questions : [];
  return {
    hasAttempt: Boolean(raw?.has_attempt),
    quizTitle: raw?.quiz?.title,
    personalizedFeedback: raw?.personalized_feedback ?? null,
    summary: {
      total: Number(summary?.total_questions ?? summary?.total ?? questions.length ?? 0),
      correct: Number(summary?.correct ?? 0),
      percent: Number(summary?.percent_correct ?? summary?.percent ?? 0),
    },
    questions: questions.map((question: any) => ({
      id: question?.question_id || question?.id || "",
      text: question?.question_text || question?.text || "Question",
      studentAnswer: question?.student_answer ?? null,
      correctAnswer: question?.correct_answer ?? null,
      isCorrect: Boolean(question?.is_correct),
      difficultyLabel: question?.difficulty_label ?? null,
      difficultyScore:
        typeof question?.estimated_difficulty === "number"
          ? Number(question.estimated_difficulty)
          : null,
    })),
  };
}

export default function DiagnosticResultsPage() {
  const { unitId } = useParams();
  const nav = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!unitId) {
        setError("Missing unit id.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const [unitData, resultData] = await Promise.all([
          UnitsAPI.getUnit(unitId),
          fetchDiagnosticResults(unitId),
        ]);
        if (!mounted) return;
        if (!unitData) {
          setError("Unit not found.");
          setUnit(null);
        } else {
          setUnit(unitData);
        }
        setReview(mapApiResponse(resultData));
      } catch (err) {
        console.error("Failed to load diagnostic results", err);
        if (mounted) setError("Unable to load diagnostic results. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [unitId]);

  const summaryText = useMemo(() => {
    if (!review || !review.hasAttempt) return "Complete the diagnostic to unlock this summary.";
    const { correct, total, percent } = review.summary;
    if (!total) return "No question data recorded for this diagnostic.";
    return `${correct} of ${total} correct (${percent}% accurate)`;
  }, [review]);

  const handleBack = () => {
    if (unitId) {
      nav(`/units/${unitId}`);
    } else {
      nav("/units");
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="empty">Loading diagnostic results…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="empty">
          <p>{error}</p>
          <button className="btn" onClick={handleBack}>
            Back to units
          </button>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="page">
        <div className="empty">
          Unable to display diagnostic results.
          <button className="btn u-mt-16" onClick={handleBack}>
            Back to units
          </button>
        </div>
      </div>
    );
  }

  const hasAttempt = review.hasAttempt;

  if (!hasAttempt) {
    return (
      <div className="page diagnostic-results-page">
        <div className="page-header">
          <div>
            <p className="muted small">{unit?.title || "Unit"}</p>
            <h1>Diagnostic results</h1>
            <p className="muted">You have not taken this diagnostic yet.</p>
          </div>
        </div>
        <div className="card diagnostic-results-card">
          <p>
            Once you complete the diagnostic, you will see a full review of each question here.
          </p>
          <div className="diagnostic-results-actions">
            <button className="btn" onClick={handleBack}>
              Back to unit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page diagnostic-results-page">
      <div className="page-header">
        <div>
          <p className="muted small">{unit?.title || "Unit"}</p>
          <h1>Diagnostic results</h1>
          <p className="muted">{summaryText}</p>
        </div>
        <div className="hero-actions">
          <button className="btn" onClick={handleBack}>
            Back to unit
          </button>
        </div>
      </div>

      <div className="card diagnostic-results-card">
        <div className="diagnostic-results-summary">
          <div>
            <p className="muted small">Score</p>
            <strong>
              {review.summary.correct} / {review.summary.total} correct
            </strong>
          </div>
          <div className="diagnostic-results-pill">{review.summary.percent}%</div>
        </div>
        {review.quizTitle && (
          <p className="muted small">Quiz: {review.quizTitle}</p>
        )}
      </div>

      {review.personalizedFeedback && (
        <div className="card diagnostic-feedback-card">
          <p className="muted small">Personalized feedback</p>
          <p className="u-mt-8 u-mb-0">{review.personalizedFeedback}</p>
        </div>
      )}

      <div className="card question-review-card">
        <div className="question-review-head">
          <div>
            <h3 className="u-mt-0 u-mb-4">Question review</h3>
            <p className="muted small">
              See how you answered each item. Diagnostics are read only — no retakes from here.
            </p>
          </div>
        </div>
        <ul className="question-review-list">
          {review.questions.map((question) => {
            const starMap: Record<string, string> = {
              easy: "★☆☆",
              medium: "★★☆",
              hard: "★★★",
            };
            const scoreDisplay =
              typeof question.difficultyScore === "number"
                ? `${Math.round(question.difficultyScore * 100)}%`
                : null;
            return (
            <li key={question.id} className="question-review-row">
              <div>
                <p className="question-text">{question.text}</p>
                {question.difficultyLabel && (
                  <p className="muted tiny helper-text">
                    Difficulty:{" "}
                    <strong>
                      {starMap[question.difficultyLabel] || question.difficultyLabel}
                    </strong>{" "}
                    {scoreDisplay && <>({scoreDisplay})</>}
                  </p>
                )}
                <p className="muted small">
                  Your answer: <strong>{question.studentAnswer ?? "—"}</strong>
                </p>
                <p className="muted small">
                  Correct answer: <strong>{question.correctAnswer ?? "—"}</strong>
                </p>
              </div>
              <span
                className={`review-chip ${
                  question.isCorrect ? "review-chip-correct" : "review-chip-incorrect"
                }`}
              >
                {question.isCorrect ? "Correct" : "Incorrect"}
              </span>
            </li>
          );
          })}
          {review.questions.length === 0 && (
            <li className="question-review-row">
              <p className="muted small">No question-level data available for this diagnostic.</p>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
