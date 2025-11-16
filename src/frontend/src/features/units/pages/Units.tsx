import React, { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [unitData, attemptData] = await Promise.all([
          UnitsAPI.listUnits(),
          fetchAttempts(),
        ]);
        if (!mounted) return;
        setUnits(unitData);
        setAttempts(normalizeAttempts(attemptData || []));
        try {
          const data = await fetchNextActivity();
          if (mounted && data) {
            setNextActivity({
              unitId: data.unit_id,
              sectionId: data.section_id,
              activity: data.activity,
            });
          }
        } catch (recErr) {
          if (mounted) setNextActivity(null);
        }
      } catch (err) {
        console.error("Failed to load units", err);
        if (mounted) setError("Unable to load units. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const attemptIndex = useMemo(
    () => buildUnitAttemptIndex(attempts),
    [attempts]
  );

  const enrichedUnits = useMemo(
    () =>
      units.map((unit) => {
        const unitAttempts = attemptIndex[unit.id]?.attempts ?? [];
        const mastery = calcMasteryScore(unitAttempts);
        const diagUnlocked =
          hasTakenDiagnostic(unit.id) ||
          hasDiagnosticAttempt(unit.id, attemptIndex);
        const recommended = nextActivity?.unitId === unit.id;
        return { unit, mastery, diagUnlocked, recommended };
      }),
    [units, attemptIndex, hasTakenDiagnostic, nextActivity]
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Your learning path</h1>
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

      {loading && <div className="empty">Loading units…</div>}
      {error && <div className="empty">{error}</div>}

      {!loading && !error && (
        <div className="unit-path">
          {enrichedUnits.map(({ unit, mastery, diagUnlocked, recommended }) => {
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
                    <h3>{unit.title}</h3>
                    <p className="muted small">{unit.description}</p>
                  </div>
                  <div className="unit-path-meta">
                    {recommended && (
                      <span className="badge badge-recommend">Recommended</span>
                    )}
                    <span className="unit-progress-value">{mastery}%</span>
                    <p className="muted small">Mastery</p>
                    <span
                      className={`badge ${
                        diagUnlocked ? "badge-unlocked" : "badge-locked"
                      }`}
                    >
                      {diagUnlocked ? "Unlocked" : "Locked"}
                    </span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${mastery}%` }}
                  />
                </div>
                <div className="unit-path-actions">
                  <button
                    className="btn primary"
                    onClick={() => {
                      nav(`/units/${unit.id}/diagnostic`);
                    }}
                  >
                    {diagUnlocked ? "View diagnostic" : "Start diagnostic"}
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
                            <span className="badge">{stats.status}</span>
                            {sectionRecommended && (
                              <span className="badge badge-recommend">
                                Recommended
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
