import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { UnitsAPI, type Unit } from "../services/unitsAPI";
import { fetchAttempts } from "../../../lib/historyClient";
import { normalizeAttempts } from "../../../lib/attempts";
import type { AttemptRecord } from "../../../types/attempts";
import { useProgress } from "../hooks/useProgress";
import {
  buildUnitAttemptIndex,
  calcMasteryScore,
  getSectionStats,
  hasDiagnosticAttempt,
} from "../utils/progress";
import { fetchNextActivity } from "../../../lib/studentClient";

type NextActivity = {
  unitId: string;
  sectionId?: string | null;
  activity: string;
};

export default function UnitsPage() {
  const nav = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [nextActivity, setNextActivity] = useState<NextActivity | null>(null);
  const { hasTakenDiagnostic } = useProgress();

  const loadUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [unitData, attemptData] = await Promise.all([
        UnitsAPI.listUnits(),
        fetchAttempts(),
      ]);
      setUnits(unitData);
      setAttempts(normalizeAttempts(attemptData || []));
      try {
        const data = await fetchNextActivity();
        if (data) {
          setNextActivity({
            unitId: data.unit_id,
            sectionId: data.section_id,
            activity: data.activity,
          });
        } else {
          setNextActivity(null);
        }
      } catch (recErr) {
        console.warn("Next activity unavailable", recErr);
        setNextActivity(null);
      }
    } catch (err) {
      console.error("Failed to load units", err);
      setError("We could not load your units right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const attemptIndex = useMemo(
    () => buildUnitAttemptIndex(attempts),
    [attempts]
  );

  const enrichedUnits = useMemo(
    () =>
      units.map((unit) => {
        const unitAttempts = attemptIndex[unit.id]?.attempts ?? [];
        const mastery = calcMasteryScore(unitAttempts);
        const diagnosticAttempted = hasDiagnosticAttempt(unit.id, attemptIndex);
        const diagUnlocked =
          hasTakenDiagnostic(unit.id) || diagnosticAttempted;
        const recommended = nextActivity?.unitId === unit.id;
        return { unit, mastery, diagUnlocked, recommended, diagnosticAttempted };
      }),
    [units, attemptIndex, hasTakenDiagnostic, nextActivity]
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Your learning path 📚</h1>
          <p className="muted">
            Complete sections to unlock new content and master Grade 9 math.
          </p>
        </div>
        <div className="hero-actions">
          <button className="btn" onClick={() => nav("/")}>
            Back to dashboard
          </button>
        </div>
      </div>

      {loading && (
        <div className="card state-card">
          <p className="muted small">Loading units…</p>
        </div>
      )}

      {error && (
        <div className="card state-card state-card-error">
          <p className="error-text">{error}</p>
          <button className="btn" onClick={loadUnits}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && enrichedUnits.length === 0 && (
        <div className="card state-card">
          <p className="u-mb-4">No units are available yet.</p>
          <p className="muted small">Ask your teacher to assign a unit.</p>
        </div>
      )}

      {!loading && !error && enrichedUnits.length > 0 && (
        <div className="unit-path">
          {enrichedUnits.map(({ unit, mastery, diagUnlocked, recommended, diagnosticAttempted }) => {
            const expanded = expandedUnit === unit.id;
            return (
              <div key={unit.id} className={`card unit-path-card ${expanded ? "expanded" : ""}`}>
                <div
                  className="unit-path-header"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setExpandedUnit((prev) => (prev === unit.id ? null : unit.id))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedUnit((prev) =>
                        prev === unit.id ? null : unit.id
                      );
                    }
                  }}
                >
                  <div>
                    <p className="muted small">Unit</p>
                    <h3>
                      <span aria-hidden="true" className="unit-emoji">
                        📘
                      </span>
                      {unit.title}
                    </h3>
                    <p className="muted small">{unit.description}</p>
                  </div>
                  <div className="unit-path-meta">
                    {recommended && (
                      <span className="status-pill status-recommended">
                        Recommended 🎯
                      </span>
                    )}
                    <span className="unit-progress-value">{mastery}%</span>
                    <p className="muted small">
                      Mastery{" "}
                      <span
                        className="helper-hint"
                        title="Mastery is a score from 0 to 1 (shown here as a percentage) estimated from recent mini quiz and unit test attempts."
                      >
                        i
                      </span>
                    </p>
                    <span
                      className={`badge ${
                        diagUnlocked ? "badge-unlocked" : "badge-locked"
                      }`}
                    >
                      {diagUnlocked ? "Unlocked" : "Locked"}
                    </span>
                  </div>
                </div>
                <progress
                  className="progress-bar"
                  max={100}
                  value={mastery}
                  aria-valuenow={mastery}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
                <div className="unit-path-actions">
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (diagnosticAttempted) {
                        nav(`/diagnostic-results/${unit.id}`);
                      } else {
                        nav(`/units/${unit.id}/diagnostic`);
                      }
                    }}
                  >
                    {diagnosticAttempted ? "Review diagnostic results" : "Take diagnostic"}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      nav(`/units/${unit.id}`);
                    }}
                  >
                    View unit
                  </button>
                  <button
                    className="btn subtle"
                    onClick={() =>
                      setExpandedUnit(expanded ? null : unit.id)
                    }
                  >
                    {expanded ? "Hide sections" : "Preview sections"}
                  </button>
                </div>
                {expanded && (
                  <div className="unit-section-preview">
                    {unit.sections.map((section) => {
                      const stats = getSectionStats(
                        unit.id,
                        section.id,
                        attemptIndex
                      );
                      const locked = !diagUnlocked;
                      const sectionRecommended =
                        recommended && nextActivity?.sectionId === section.id;
                      return (
                        <div
                          key={section.id}
                          className={`section-preview-row ${
                            locked ? "locked" : ""
                          }`}
                        >
                          <div>
                            <p className="section-title">{section.title}</p>
                            <p className="muted small">
                              {locked
                                ? "Complete the diagnostic to unlock this section."
                                : `${stats.mastery}% mastery • ${stats.status}`}
                            </p>
                          </div>
                          <div className="section-preview-actions">
                            <span
                              className={`status-pill status-${stats.status
                                .toLowerCase()
                                .replace(" ", "-")}`}
                            >
                              {stats.status}
                            </span>
                            {sectionRecommended && (
                              <span className="status-pill status-recommended">
                                Recommended 🎯
                              </span>
                            )}
                            <button
                              className="btn secondary"
                              disabled={locked || !section.practiceQuizId}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!section.practiceQuizId) return;
                                nav(
                                  `/units/${unit.id}/sections/${section.id}/practice`
                                );
                              }}
                            >
                              Practice
                            </button>
                            <button
                              className="btn"
                              disabled={locked || !section.miniQuizId}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!section.miniQuizId) return;
                                nav(
                                  `/units/${unit.id}/sections/${section.id}/mini-quiz`
                                );
                              }}
                            >
                              Mini quiz
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
