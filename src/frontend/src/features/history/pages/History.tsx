import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { fetchAttempts } from "../../../lib/historyClient";
import { normalizeAttempts } from "../../../lib/attempts";
import { UnitsAPI, type Quiz, type Unit } from "../../units/services/unitsAPI";
import AttemptRow from "../components/AttemptRow";
import type { AttemptRecord } from "../../../types/attempts";
import HistoryChart from "../components/HistoryChart";
import AttemptDetailModal from "../components/AttemptDetailModal";

function formatDateOnly(timestamp?: number) {
  if (!timestamp) return "None yet";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HistoryPage() {
  const nav = useNavigate();
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<"date" | "score">("date");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [attemptData, unitData] = await Promise.all([
        fetchAttempts(),
        UnitsAPI.listUnits(),
      ]);

      const normalizedAttempts: AttemptRecord[] = normalizeAttempts(
        attemptData || []
      );

      const uniqueQuizIds = Array.from(
        new Set(normalizedAttempts.map((a) => a.quizId))
      );

      const quizEntries = await Promise.all(
        uniqueQuizIds.map(async (id) => {
          try {
            const quiz = await UnitsAPI.getQuiz(id);
            return quiz ? [id, quiz] : null;
          } catch {
            return null;
          }
        })
      );

      const quizMap: Record<string, Quiz> = {};
      quizEntries.forEach((entry) => {
        if (entry) {
          quizMap[entry[0]] = entry[1];
        }
      });

      setUnits(unitData);
      setQuizzes(quizMap);
      setAttempts(normalizedAttempts);
    } catch (err) {
      console.error("Failed to load history", err);
      setError("We could not load your quiz history right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRetry = useCallback(() => {
    loadHistory();
  }, [loadHistory]);

  const unitsById = useMemo(() => {
    return units.reduce<Record<string, Unit>>((acc, unit) => {
      acc[unit.id] = unit;
      return acc;
    }, {});
  }, [units]);

  const activeAttempt = useMemo(
    () => attempts.find((attempt) => attempt.id === activeAttemptId) || null,
    [attempts, activeAttemptId]
  );

  const activeUnit = activeAttempt
    ? unitsById[activeAttempt.unitId]
    : undefined;
  const activeSectionTitle = activeAttempt
    ? activeUnit?.sections?.find((s) => s.id === activeAttempt.sectionId)?.title
    : undefined;
  const activeQuiz = activeAttempt
    ? quizzes[activeAttempt.quizId]
    : undefined;

  const filteredAttempts = useMemo(() => {
    const filtered =
      unitFilter === "all"
        ? attempts
        : attempts.filter((attempt) => attempt.unitId === unitFilter);
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortMode === "score") {
        return (b.scorePct || 0) - (a.scorePct || 0);
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return sorted;
  }, [attempts, unitFilter, sortMode]);

  const safeAttempts =
    Array.isArray(filteredAttempts) && filteredAttempts.length
      ? filteredAttempts
      : [];

  const totalQuizzes = attempts.length;
  const averageScore = totalQuizzes
    ? Math.round(
        attempts.reduce((sum, attempt) => sum + (attempt.scorePct || 0), 0) /
          totalQuizzes
      )
    : 0;
  const lastQuizDate = attempts[0]?.createdAt;

  if (loading) {
    return (
      <div className="page">
        <div className="card state-card">
          <p className="muted small">Loading quiz history…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card state-card state-card-error">
          <p className="error-text">{error}</p>
          <button className="btn" onClick={handleRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const firstUnit = units[0];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Quiz history</h1>
          <p className="muted">
            Review every quiz you have taken. Click a row to inspect answers.
          </p>
        </div>
        <div className="hero-actions">
          <button className="btn" onClick={() => nav("/")}>
            Back to dashboard
          </button>
        </div>
      </div>

      {attempts.length === 0 ? (
        <div className="card empty-card history-empty-card">
          <p className="u-mb-8">
            No history yet. Start by taking your first diagnostic.
          </p>
          {firstUnit ? (
            <button
              className="btn primary"
              onClick={() => nav(`/units/${firstUnit.id}/diagnostic`)}
            >
              Take your first diagnostic
            </button>
          ) : (
            <span className="muted">
              Add a unit to start tracking quiz history.
            </span>
          )}
        </div>
      ) : (
        <>
          <div className="history-stats">
            <div className="card stat-card">
              <p className="muted small">Total quizzes</p>
              <strong className="stat-value">{totalQuizzes}</strong>
            </div>
            <div className="card stat-card">
              <p className="muted small">Average score</p>
              <strong className="stat-value">{averageScore}%</strong>
            </div>
            <div className="card stat-card">
              <p className="muted small">Last quiz</p>
              <strong className="stat-value">{formatDateOnly(lastQuizDate)}</strong>
            </div>
          </div>

          <div className="card chart-card">
            <div className="card-head">
              <div>
                <h3>Progress over time 📈</h3>
                <p className="muted small">
                  Hover the points to inspect your recent scores.
                </p>
              </div>
            </div>
            {safeAttempts.length > 0 ? (
              <HistoryChart attempts={safeAttempts} />
            ) : (
              <div className="history-empty-state">
                <p>No quiz history yet. Complete a quiz to see your progress here.</p>
              </div>
            )}
          </div>

          <div className="history-controls">
            <label>
              <span className="muted small">Filter by unit</span>
              <select
                className="input"
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
              >
                <option value="all">All topics</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="muted small">Sort by</span>
              <select
                className="input"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as "date" | "score")}
              >
                <option value="date">Date (newest)</option>
                <option value="score">Score (highest)</option>
              </select>
            </label>
          </div>

          <div className="card history-card">
            <div className="history-header">
              <span>Date &amp; Time</span>
              <span>Topic</span>
              <span>Quiz</span>
              <span>Type</span>
              <span>
                Hints{" "}
                <span
                  className="helper-hint inline"
                  title="Hint usage is the percentage of questions where you requested a hint."
                >
                  i
                </span>
              </span>
              <span>Score</span>
              <span />
            </div>
            {safeAttempts.map((attempt) => (
              <AttemptRow
                key={attempt.id}
                attempt={attempt}
                unitTitle={unitsById[attempt.unitId]?.title || "Unknown unit"}
                sectionTitle={
                  unitsById[attempt.unitId]?.sections?.find(
                    (s) => s.id === attempt.sectionId
                  )?.title
                }
                quiz={quizzes[attempt.quizId]}
                onSelect={() => setActiveAttemptId(attempt.id)}
              />
            ))}
          </div>
        </>
      )}

      {activeAttempt && (
        <AttemptDetailModal
          attempt={activeAttempt}
          unitTitle={activeUnit?.title || "Unknown unit"}
          sectionTitle={activeSectionTitle}
          quiz={activeQuiz}
          onClose={() => setActiveAttemptId(null)}
        />
      )}
    </div>
  );
}
