import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import QuestionCard from "../components/QuestionCard";
import SummaryCard from "../components/SummaryCard";
import FeedbackCallout from "../components/FeedbackCallout";
import {
  UnitsAPI,
  type Question,
  type Unit,
  type UnitSection,
} from "../services/unitsAPI";
import {
  createAttempt,
  fetchNextPracticeQuestion,
  rememberLearningLocation,
} from "../../../lib/studentClient";

type PracticeAnswer = {
  questionId: string;
  correct: boolean;
  chosenAnswer: string;
  usedHint: boolean;
};

function mapQuestion(raw: any): Question {
  return {
    id: String(raw.id),
    type: raw.type === "boolean" ? "boolean" : "mcq",
    prompt: raw.text ?? raw.prompt ?? "Untitled question",
    options: raw.options,
    answer: raw.correct_answer ?? raw.answer,
  };
}

export default function PracticePage() {
  const { unitId, sectionId } = useParams();
  const nav = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [section, setSection] = useState<UnitSection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [sessionAnswers, setSessionAnswers] = useState<PracticeAnswer[]>([]);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [sessionFeedback, setSessionFeedback] = useState<string | null>(null);
  const [justAnswered, setJustAnswered] = useState<"correct" | "wrong" | null>(
    null
  );
  const [hintUsed, setHintUsed] = useState(false);
  const [answering, setAnswering] = useState(false);

  const accuracy = useMemo(() => {
    if (sessionAnswers.length === 0) return 0;
    const correct = sessionAnswers.filter((a) => a.correct).length;
    return Math.round((correct / sessionAnswers.length) * 100);
  }, [sessionAnswers]);

  const answeredCount = sessionAnswers.length;

  const confirmLeave = useCallback(() => {
    if (sessionAnswers.length === 0) return true;
    return window.confirm("End this practice session and save your progress?");
  }, [sessionAnswers.length]);

  const loadQuestion = useCallback(async () => {
    if (!unitId) return;
    setQuestionError(null);
    setLoadingQuestion(true);
    try {
      const raw = await fetchNextPracticeQuestion({
        unitId,
        sectionId,
      });
      setQuestion(mapQuestion(raw));
      setHintUsed(false);
    } catch (err: any) {
      console.error("Failed to fetch next practice question", err);
      const message =
        err?.message && err.message.includes("no_question_available")
          ? "No more questions are available for this section right now."
          : "Unable to fetch the next question.";
      setQuestionError(message);
      setQuestion(null);
    } finally {
      setLoadingQuestion(false);
    }
  }, [unitId, sectionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!unitId || !sectionId) {
          setError("Missing unit or section id.");
          return;
        }
        setLoadingMeta(true);
        setError(null);
        const u = await UnitsAPI.getUnit(unitId);
        if (!u) {
          setError("Unit not found.");
          return;
        }
        const sectionData = u.sections.find((s) => s.id === sectionId);
        if (!sectionData) {
          setError("Section not found.");
          return;
        }
        if (cancelled) return;
        setUnit(u);
        setSection(sectionData);
        rememberLearningLocation({
          unitId: u.id,
          sectionId,
          activity: "practice",
        }).catch(() => {});
        await loadQuestion();
      } catch (err) {
        console.error("Failed to load practice session", err);
        if (!cancelled) setError("Unable to load practice session.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId, sectionId, loadQuestion]);

  const handleAnswer = (choice: string) => {
    if (!question || answering) return;
    const normalizedChoice = String(choice).trim();
    const isCorrect = normalizedChoice === String(question.answer).trim();
    setJustAnswered(isCorrect ? "correct" : "wrong");
    setSessionAnswers((prev) => [
      ...prev,
      {
        questionId: question.id,
        correct: isCorrect,
        chosenAnswer: choice,
        usedHint: hintUsed,
      },
    ]);
    setAnswering(true);
    setTimeout(() => {
      void loadQuestion().finally(() => {
        setAnswering(false);
        setJustAnswered(null);
      });
    }, 320);
  };

  const handleSkip = () => {
    setJustAnswered(null);
    setHintUsed(false);
    void loadQuestion();
  };

  const handleEndSession = async () => {
    if (!confirmLeave()) return;
    if (!unit || !section || !sectionId) {
      nav(`/units/${unit?.id ?? ""}`);
      return;
    }
    setSessionFeedback(null);
    const total = sessionAnswers.length;
    const correct = sessionAnswers.filter((a) => a.correct).length;
    const scorePct = total ? Math.round((correct / total) * 100) : 0;
    setFinalScore(scorePct);
    if (total === 0) {
      rememberLearningLocation({
        unitId: unit.id,
        sectionId,
        activity: "practice",
      }).catch(() => {});
      nav(`/units/${unit.id}`);
      return;
    }
    try {
      const result = await createAttempt({
        quizId:
          section.practiceQuizId ??
          `practice-${unit.id}-${sectionId || "section"}`,
        quizType: "practice",
        unitId: unit.id,
        sectionId,
        scorePct,
        results: sessionAnswers,
      });
      setSessionFeedback(result?.personalized_feedback ?? null);
    } catch (err) {
      console.error("Could not record practice attempt", err);
      setSessionFeedback(null);
    }
    rememberLearningLocation({
      unitId: unit.id,
      sectionId,
      activity: "practice",
    }).catch(() => {});
    setSessionFinished(true);
  };

  const handleRestart = () => {
    setSessionAnswers([]);
    setSessionFinished(false);
    setFinalScore(0);
    setSessionFeedback(null);
    setHintUsed(false);
    setJustAnswered(null);
    void loadQuestion();
  };

  if (loadingMeta) {
    return (
      <div className="page">
        <div className="empty">Loading practice…</div>
      </div>
    );
  }

  if (error || !unit || !section) {
    return (
      <div className="page">
        <div className="empty">{error || "Practice not available."}</div>
      </div>
    );
  }

  if (sessionFinished) {
    const passed = finalScore >= 70;
    return (
      <div className="page">
        <div className="quiz-top-bar">
          <button
            className="btn"
            onClick={() => {
              if (confirmLeave()) nav(`/units/${unit.id}`);
            }}
          >
            ← Back
          </button>
          <div>
            <p className="muted small">{unit.title}</p>
            <h2 style={{ margin: 0 }}>Practice summary</h2>
            <p className="muted small">{section.title}</p>
          </div>
          <button className="btn secondary" onClick={() => nav(`/units/${unit.id}`)}>
            View unit
          </button>
        </div>
        <SummaryCard
          title={`${section.title} practice`}
          scorePct={finalScore}
          passed={passed}
          primaryLabel="Back to unit"
          secondaryLabel="Practice more"
          detail={
            sessionFeedback ? (
              <FeedbackCallout message={sessionFeedback} />
            ) : undefined
          }
          onPrimary={() => nav(`/units/${unit.id}`)}
          onSecondary={handleRestart}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="practice-top-bar">
        <div className="practice-top-info">
          <button
            className="btn"
            onClick={() => {
              if (confirmLeave()) nav(`/units/${unit.id}`);
            }}
          >
            ← Back
          </button>
          <div>
            <p className="muted small">Adaptive practice session</p>
            <h2 style={{ margin: "2px 0" }}>{section.title}</h2>
            <p className="muted small">
              {unit.title} • {answeredCount}{" "}
              {answeredCount === 1 ? "question answered" : "questions answered"}
            </p>
          </div>
        </div>
        <div className="practice-top-controls">
          <button
            className="btn subtle"
            onClick={handleSkip}
            disabled={loadingQuestion || !question}
          >
            Skip question
          </button>
          <button className="btn primary" onClick={handleEndSession}>
            End session
          </button>
        </div>
      </div>

      <div className="card practice-card">
        <div className="practice-header">
          <div>
            <p className="muted small">Session stats</p>
            <h3>Keep answering to build mastery</h3>
            <p className="muted small">
              We will keep serving fresh questions until you end the session.
            </p>
          </div>
          <div className="practice-stats">
            <div>
              <p className="muted small">Answered</p>
              <strong className="stat-value">{sessionAnswers.length}</strong>
            </div>
            <div>
              <p className="muted small">Accuracy</p>
              <strong className="stat-value">{accuracy}%</strong>
            </div>
          </div>
        </div>

        <div className="practice-status">
          {justAnswered && (
            <span className={`pill ${justAnswered}`}>
              {justAnswered === "correct" ? "Correct" : "Try again"}
            </span>
          )}
          {questionError && <span className="muted small">{questionError}</span>}
        </div>

        {loadingQuestion && !question ? (
          <div className="empty">Fetching your next question…</div>
        ) : question ? (
          <QuestionCard
            q={question}
            onSubmit={handleAnswer}
            onHintUsed={() => setHintUsed(true)}
          />
        ) : (
          <div className="empty small">
            We could not load a question right now. Try again in a moment.
          </div>
        )}
      </div>
    </div>
  );
}
