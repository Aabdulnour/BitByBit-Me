import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UnitsAPI, type Unit } from "../services/unitsAPI";
import { fetchAttempts } from "../../../lib/historyClient";
import { normalizeAttempts } from "../../../lib/attempts";
import type { AttemptRecord } from "../../../types/attempts";
import { useProgress } from "../hooks/useProgress";
import {
  buildUnitAttemptIndex,
  calcMasteryScore,
  classifyPlacement,
  describePlacement,
  filterAttemptsByType,
  getSectionStats,
  hasDiagnosticAttempt,
} from "../utils/progress";

export default function UnitDetailPage() {
  const { unitId } = useParams();
  const nav = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasTakenDiagnostic, markDiagnosticTaken } = useProgress();

  const loadUnitDetail = useCallback(async () => {
    if (!unitId) {
      setError("Unit not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [unitData, attemptData] = await Promise.all([
        UnitsAPI.getUnit(unitId),
        fetchAttempts(),
      ]);
      if (!unitData) {
        setError("Unit not found.");
        setUnit(null);
      } else {
        setUnit(unitData);
      }
      setAttempts(normalizeAttempts(attemptData || []));
    } catch (err) {
      console.error("Failed to load unit detail", err);
      setError("We could not load this unit right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    loadUnitDetail();
  }, [loadUnitDetail]);

  const unitAttempts = useMemo(() => {
    if (!unitId) return [];
    return attempts.filter((a) => a.unitId === unitId);
  }, [attempts, unitId]);

  const stats = useMemo(() => {
    const masteryAttempts = filterAttemptsByType(unitAttempts, [
      "mini_quiz",
      "unit_test",
    ]);
    if (unitAttempts.length === 0) {
      return {
        mastery: 0,
        total: 0,
        lastDiagnostic: null,
        lastUnitTest: null,
      };
    }
    const masteryAvg = calcMasteryScore(unitAttempts);
    const lastDiagnostic =
      unitAttempts.find((a) => a.quizType === "diagnostic")?.scorePct ?? null;
    const lastUnitTest =
      unitAttempts.find((a) => a.quizType === "unit_test")?.scorePct ?? null;
    return {
      mastery: masteryAvg,
      total: masteryAttempts.length,
      lastDiagnostic,
      lastUnitTest,
    };
  }, [unitAttempts]);

  const attemptIndex = useMemo(
    () => buildUnitAttemptIndex(unitAttempts),
    [unitAttempts]
  );

  const storedTaken = unit ? hasTakenDiagnostic(unit.id) : false;
  const hasDiagnosticRecord = unit
    ? hasDiagnosticAttempt(unit.id, attemptIndex)
    : false;

  useEffect(() => {
    if (unit && hasDiagnosticRecord && !storedTaken) {
      markDiagnosticTaken(unit.id);
    }
  }, [unit, hasDiagnosticRecord, storedTaken, markDiagnosticTaken]);

  const latestDiagnosticAttempt = useMemo(() => {
    return unitAttempts.find((a) => a.quizType === "diagnostic") ?? null;
  }, [unitAttempts]);

  if (loading) {
    return (
      <div className="page">
        <div className="card state-card">
          <p className="muted small">Loading unit…</p>
        </div>
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="page">
        <div className="card state-card state-card-error">
          <p className="error-text">{error || "Unit not found."}</p>
          <button className="btn" onClick={loadUnitDetail}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const diagnosticTaken = storedTaken || hasDiagnosticRecord;
  const placementLevel = classifyPlacement(latestDiagnosticAttempt?.scorePct);
  const placementDescription = describePlacement(placementLevel);
  const diagnosticScore = latestDiagnosticAttempt?.scorePct ?? null;

  return (
    <div className="page">
      <div className="card diagnostic-card">
        {diagnosticTaken ? (
          <div className="diagnostic-summary">
            <div>
              <p className="muted small">Unit diagnostic</p>
              <h3>Diagnostic completed</h3>
              <p className="muted small">{placementDescription}</p>
            </div>
            <div className="diagnostic-score">
              <span>{diagnosticScore != null ? `${diagnosticScore}%` : "—"}</span>
              <p className="muted small">
                Placement {placementLevel || "Pending"}
              </p>
            </div>
            <div className="diagnostic-actions">
              <button
                className="btn secondary"
                onClick={() => nav(`/diagnostic-results/${unit.id}`)}
              >
                Review diagnostic results
              </button>
            </div>
          </div>
        ) : (
          <div className="diagnostic-intro">
            <div>
              <p className="muted small">Unit diagnostic</p>
              <h3>Find your starting point</h3>
              <p className="muted small">
                A quick check to place you at the right level for this unit.
              </p>
            </div>
            <button
              className="btn primary"
              onClick={() => nav(`/units/${unit.id}/diagnostic`)}
            >
              Take diagnostic
            </button>
          </div>
        )}
      </div>

      <div className="card unit-hero-card">
        <div>
          <p className="muted small">Unit</p>
          <h1 className="u-mt-4 u-mb-8">{unit.title}</h1>
          <p className="muted u-maxw-600">
            {unit.description}
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="btn primary"
            onClick={() =>
              diagnosticTaken
                ? nav(`/diagnostic-results/${unit.id}`)
                : nav(`/units/${unit.id}/diagnostic`)
            }
          >
            {diagnosticTaken ? "Review diagnostic results" : "Take diagnostic"}
          </button>
          <button
            className="btn"
            disabled={!diagnosticTaken}
            onClick={() => nav(`/units/${unit.id}/test`)}
          >
            Take unit test
          </button>
        </div>
      </div>

      <div className="card mastery-card">
        <div className="card-head compact">
          <h3>Mastery snapshot</h3>
          <span
            className="helper-hint"
            title="Mastery is a score from 0 to 1 (displayed here as a percent) estimated from recent mini quiz and unit test attempts."
          >
            i
          </span>
        </div>
        <div className="stat-grid">
          <div>
            <p className="muted small">Mastery average</p>
            <strong className="stat-value">{stats.mastery}%</strong>
          </div>
          <div>
            <p className="muted small">Scored quizzes</p>
            <strong className="stat-value">{stats.total}</strong>
          </div>
          <div>
            <p className="muted small">Last diagnostic</p>
            <strong className="stat-value">
              {stats.lastDiagnostic != null ? `${stats.lastDiagnostic}%` : "—"}
            </strong>
          </div>
          <div>
            <p className="muted small">Last unit test</p>
            <strong className="stat-value">
              {stats.lastUnitTest != null ? `${stats.lastUnitTest}%` : "—"}
            </strong>
          </div>
        </div>
      </div>

      <div className="card sections-card">
        <h3>Sections</h3>
        <div className="sections">
          {unit.sections.map((section) => {
            const locked = !diagnosticTaken;
            const sectionStats = getSectionStats(
              unit.id,
              section.id,
              attemptIndex
            );
            return (
              <div
                key={section.id}
                className={`row ${locked ? "locked" : ""}`}
              >
                <div>
                  <strong>{section.title}</strong>
                  <p className="muted small">
                    {locked
                      ? "Complete the diagnostic to unlock"
                      : `${sectionStats.mastery}% mastery • ${sectionStats.status}`}
                  </p>
                  {section.summary && (
                    <p className="muted small">{section.summary}</p>
                  )}
                </div>
                <div className="section-actions">
                  <span
                    className={`status-pill ${
                      locked
                        ? "status-locked"
                        : `status-${sectionStats.status
                            .toLowerCase()
                            .replace(" ", "-")}`
                    }`}
                  >
                    {locked ? "Locked" : sectionStats.status}
                  </span>
                  <button
                    className="btn secondary"
                    disabled={locked || !section.practiceQuizId}
                    onClick={() =>
                      nav(`/units/${unit.id}/sections/${section.id}/practice`)
                    }
                  >
                    Practice
                  </button>
                  <button
                    className="btn"
                    disabled={locked || !section.miniQuizId}
                    onClick={() =>
                      nav(`/units/${unit.id}/sections/${section.id}/mini-quiz`)
                    }
                  >
                    Mini quiz
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card unit-test-card">
        <div>
          <p className="muted small">Comprehensive Unit Test</p>
          <h3>Ready for the big challenge?</h3>
          <p className="muted">
            Test your knowledge of all topics in this unit once you unlock it.
          </p>
        </div>
        <button
          className="btn primary"
          disabled={!diagnosticTaken}
          onClick={() => nav(`/units/${unit.id}/test`)}
        >
          Start unit quiz
        </button>
      </div>
    </div>
  );
}
