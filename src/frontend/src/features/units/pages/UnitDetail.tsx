import React, { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!unitId) {
        setError("Unit not found.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [unitData, attemptData] = await Promise.all([
          UnitsAPI.getUnit(unitId),
          fetchAttempts(),
        ]);
        if (!mounted) return;
        if (!unitData) {
          setError("Unit not found.");
        } else {
          setUnit(unitData);
        }
        setAttempts(normalizeAttempts(attemptData || []));
      } catch (err) {
        console.error("Failed to load unit detail", err);
        if (mounted) setError("Unable to load unit details.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [unitId]);

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
        <div className="empty">Loading unit…</div>
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="page">
        <div className="empty">{error || "Unit not found."}</div>
      </div>
    );
  }

  const diagnosticTaken = storedTaken || hasDiagnosticRecord;
  const placementLevel = classifyPlacement(latestDiagnosticAttempt?.scorePct);

  return (
    <div className="page">
      <div className="card unit-hero-card">
        <div>
          <p className="muted small">Unit</p>
          <h1 style={{ margin: "4px 0 8px" }}>{unit.title}</h1>
          <p className="muted" style={{ maxWidth: 600 }}>
            {unit.description}
          </p>
        </div>
        <div className="hero-actions">
          <div className="unit-hero-meta">
            {placementLevel && (
              <span className="placement-pill">
                Your starting level: {placementLevel}
              </span>
            )}
            {latestDiagnosticAttempt?.scorePct != null && (
              <p className="muted small">
                Diagnostic score: {latestDiagnosticAttempt.scorePct}%
              </p>
            )}
          </div>
        </div>
        <div className="hero-actions">
          <button
            className="btn primary"
            onClick={() => nav(`/units/${unit.id}/diagnostic`)}
          >
            {diagnosticTaken ? "View diagnostic" : "Start diagnostic"}
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
        <h3>Mastery snapshot</h3>
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
                  <span className={`badge ${locked ? "badge-locked" : ""}`}>
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
