import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UnitsAPI, type Unit } from "../../units/services/unitsAPI";
import { fetchStudentState, fetchNextActivity } from "../../../lib/studentClient";
import { fetchAttempts } from "../../../lib/historyClient";
import { normalizeAttempts } from "../../../lib/attempts";
import type { AttemptRecord } from "../../../types/attempts";
import {
  calcMasteryScore,
  filterAttemptsByType,
} from "../../units/utils/progress";

type NextActivity = {
  unitId: string;
  sectionId?: string | null;
  activity: string;
};

export default function HomeDashboard() {
  const nav = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [studentName, setStudentName] = useState<string>("Student");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextActivity, setNextActivity] = useState<NextActivity | null>(null);
  const [nextActivityLoading, setNextActivityLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError(null);
        const [u, s, a] = await Promise.all([
          UnitsAPI.listUnits(),
          fetchStudentState(),
          fetchAttempts(),
        ]);
        if (!mounted) return;
        setUnits(u);
        if (s && s.name) {
          setStudentName(s.name);
        }
        setAttempts(normalizeAttempts(a || []));
      } catch (e) {
        console.error("Failed to load dashboard data", e);
        if (mounted) setError("Unable to load dashboard data right now.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    (async () => {
      try {
        const data = await fetchNextActivity();
        if (!mounted) return;
        if (data) {
          setNextActivity({
            unitId: data.unit_id,
            sectionId: data.section_id,
            activity: data.activity,
          });
        } else {
          setNextActivity(null);
        }
      } catch (err) {
        console.warn("Could not load next activity", err);
        if (mounted) setNextActivity(null);
      } finally {
        if (mounted) setNextActivityLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const recommendedUnit = useMemo(() => {
    if (!nextActivity) return null;
    return units.find((u) => u.id === nextActivity.unitId) || null;
  }, [units, nextActivity]);

  const recommendedSection = useMemo(() => {
    if (!nextActivity?.sectionId || !recommendedUnit) return null;
    return (
      recommendedUnit.sections.find((s) => s.id === nextActivity.sectionId) || null
    );
  }, [recommendedUnit, nextActivity]);

  const masteryAttempts = useMemo(
    () =>
      filterAttemptsByType(attempts, ["mini_quiz", "unit_test"]).sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      ),
    [attempts]
  );

  const topicStats = useMemo(() => {
    const byUnit: Record<
      string,
      { total: number; count: number; title: string }
    > = {};
    for (const u of units) {
      byUnit[u.id] = { total: 0, count: 0, title: u.title };
    }
    for (const a of masteryAttempts) {
      if (!byUnit[a.unitId]) continue;
      byUnit[a.unitId].total += a.scorePct || 0;
      byUnit[a.unitId].count += 1;
    }
    return Object.entries(byUnit).map(([id, v]) => {
      const avg = v.count ? Math.round(v.total / v.count) : 0;
      return { id, title: v.title, avg };
    });
  }, [units, masteryAttempts]);

  const quizzesTaken = attempts.length;
  const averageScore = quizzesTaken
    ? Math.round(
        attempts.reduce((sum, a) => sum + (a.scorePct || 0), 0) / quizzesTaken
      )
    : 0;
  const overallMastery = calcMasteryScore(masteryAttempts);

  const recommendationDescription = useMemo(() => {
    if (nextActivityLoading) return "Calculating your next step…";
    if (!nextActivity || !recommendedUnit) {
      return "Complete a diagnostic to unlock personalized guidance.";
    }
    const unitTitle = recommendedUnit.title;
    const sectionTitle = recommendedSection?.title
      ? `, ${recommendedSection.title}`
      : "";
    switch (nextActivity.activity) {
      case "diagnostic":
        return `Take the diagnostic for ${unitTitle}`;
      case "mini_quiz":
        return `Mini quiz in ${unitTitle}${sectionTitle}`;
      case "unit_test":
        return `Unit test for ${unitTitle}`;
      default:
        return `Keep practicing ${unitTitle}${sectionTitle}`;
    }
  }, [nextActivity, recommendedUnit, recommendedSection, nextActivityLoading]);

  const recommendationBadge = useMemo(() => {
    if (!nextActivity) {
      return nextActivityLoading ? "Loading…" : null;
    }
    switch (nextActivity.activity) {
      case "diagnostic":
        return "Diagnostic";
      case "mini_quiz":
        return "Mini quiz";
      case "unit_test":
        return "Unit test";
      default:
        return "Practice";
    }
  }, [nextActivity, nextActivityLoading]);

  const recommendationRoute = useMemo(() => {
    if (!nextActivity) return null;
    const base = `/units/${nextActivity.unitId}`;
    switch (nextActivity.activity) {
      case "diagnostic":
        return `${base}/diagnostic`;
      case "unit_test":
        return `${base}/test`;
      case "mini_quiz":
        return nextActivity.sectionId
          ? `${base}/sections/${nextActivity.sectionId}/mini-quiz`
          : base;
      case "practice":
        return nextActivity.sectionId
          ? `${base}/sections/${nextActivity.sectionId}/practice`
          : base;
      default:
        return null;
    }
  }, [nextActivity]);

  if (loading) {
    return (
      <div className="page">
        <div className="empty">Loading dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="empty">
          <p style={{ margin: 0 }}>{error}</p>
          <p className="muted small" style={{ marginTop: 8 }}>
            Please refresh this page once your connection is back.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card hero home-hero">
        <div className="home-hero-text">
          <p className="muted small">Welcome back</p>
          <h1 style={{ marginBottom: 8 }}>{studentName} 👋</h1>
          <p>
            Keep up the great work. You are making solid progress in Grade 9
            math.
          </p>
        </div>
        <div className="avatar-card home-avatar-card">
          <div className="avatar-shell home-avatar-shell">
            {/* TODO: Replace this placeholder with Ready Player Me iframe or canvas embed */}
            <span>Your 3D avatar</span>
          </div>
          <div className="avatar-info">
            <p className="muted small">Overall mastery</p>
            <span className="avatar-mastery">{overallMastery}%</span>
            <p className="muted small">Keep building your streak.</p>
          </div>
        </div>
      </div>

      <div className="card recommendation-card">
        <div>
          <p className="muted small">Recommended next step</p>
          <h3 style={{ margin: "4px 0 6px" }}>
            {recommendedUnit?.title || "Personalized learning"}
          </h3>
          <p className="muted small">{recommendationDescription}</p>
        </div>
        <div className="recommendation-actions">
          {recommendationBadge && (
            <button
              type="button"
              className="badge badge-recommend badge-link"
              disabled={!recommendationRoute}
              onClick={() => {
                if (recommendationRoute) nav(recommendationRoute);
              }}
            >
              {recommendationBadge}
            </button>
          )}
          <button
            className="btn primary"
            disabled={!recommendationRoute}
            onClick={() => {
              if (recommendationRoute) nav(recommendationRoute);
            }}
          >
            Jump in
          </button>
        </div>
      </div>

      <div className="card-grid">
        <div className="card clickable quick-card" onClick={() => nav("/units")}>
          <h3>Units</h3>
          <p>Browse all topics and sections.</p>
        </div>
        <div
          className="card clickable quick-card"
          onClick={() => nav("/history")}
        >
          <h3>View history</h3>
          <p>See past quizzes and scores.</p>
        </div>
        <div className="card quick-card mastery-card">
          <h3>Overall mastery 📊</h3>
          <p className="muted small">Based on your quizzes so far</p>
          <span className="mastery-value">{overallMastery}%</span>
        </div>
      </div>

      <div className="dashboard-columns">
        <div className="card topic-card">
          <div className="card-head">
            <div>
              <h3>Topic mastery</h3>
              <p className="muted small">
                Track your progress across every unit.
              </p>
            </div>
          </div>
          {topicStats.length === 0 ? (
            <p>
              You have not completed any quizzes yet. Start with a diagnostic
              test.
            </p>
          ) : (
            <div className="topic-list">
              {topicStats.map((t) => (
                <div key={t.id} className="topic-row">
                  <div className="topic-info">
                    <strong>{t.title}</strong>
                    <span className="muted small">{t.avg}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${t.avg}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card streak-card">
          <div>
            <h3>Learning streak</h3>
            <p className="muted small">Consistency matters.</p>
          </div>
          <div className="stat-grid compact">
            <div>
              <p className="muted small">Quizzes completed</p>
              <strong className="stat-value">{quizzesTaken}</strong>
            </div>
            <div>
              <p className="muted small">Average score</p>
              <strong className="stat-value">{averageScore}%</strong>
            </div>
          </div>
          <button className="btn secondary" onClick={() => nav("/history")}>
            View history
          </button>
        </div>
      </div>
    </div>
  );
}
