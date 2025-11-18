import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { UnitsAPI, type Unit } from "../../units/services/unitsAPI";
import { fetchStudentState, fetchNextActivity } from "../../../lib/studentClient";
import { fetchAttempts } from "../../../lib/historyClient";
import { normalizeAttempts } from "../../../lib/attempts";
import type { AttemptRecord } from "../../../types/attempts";
import {
  calcMasteryScore,
  filterAttemptsByType,
  buildUnitAttemptIndex,
} from "../../units/utils/progress";
import {
  STUDENT_AVATAR_UPDATED_EVENT,
  toAvatarImageUrl,
} from "../../../constants/avatar";

type NextActivity = {
  unitId: string;
  sectionId?: string | null;
  activity: string;
  reason?: string | null;
  skillId?: string | null;
  difficultyTarget?: number | null;
};

type NextStepSuggestion = {
  description: string;
  helper?: string;
  ctaLabel: string;
  ctaRoute: string;
  secondary?: {
    label: string;
    route: string;
  };
};

export default function HomeDashboard() {
  const nav = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [studentName, setStudentName] = useState<string>("Student");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLabel, setAvatarLabel] = useState<string>("");
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextActivity, setNextActivity] = useState<NextActivity | null>(null);
  const [nextActivityLoading, setNextActivityLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, s, a] = await Promise.all([
        UnitsAPI.listUnits(),
        fetchStudentState(),
        fetchAttempts(),
      ]);
      setUnits(u);
      if (s) {
        if (s.name) setStudentName(s.name);
        setAvatarUrl(s.avatar_url || null);
        setAvatarLabel(s.avatar_name || "");
      }
      setAttempts(normalizeAttempts(a || []));
    } catch (e) {
      console.error("Failed to load dashboard data", e);
      setError("We could not load your dashboard data right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNextActivity = useCallback(async () => {
    setNextActivityLoading(true);
    try {
      const data = await fetchNextActivity();
      if (data) {
        setNextActivity({
          unitId: data.unit_id,
          sectionId: data.section_id,
          activity: data.activity,
          reason: data.reason ?? null,
          skillId: data.skill_id ?? null,
          difficultyTarget:
            typeof data.difficulty_target === "number" ? data.difficulty_target : null,
        });
      } else {
        setNextActivity(null);
      }
    } catch (err) {
      console.warn("Could not load next activity", err);
      setNextActivity(null);
    } finally {
      setNextActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadNextActivity();
  }, [loadDashboard, loadNextActivity]);

  const handleRetry = useCallback(() => {
    loadDashboard();
    loadNextActivity();
  }, [loadDashboard, loadNextActivity]);

  useEffect(() => {
    setAvatarPreviewError(false);
  }, [avatarUrl]);

  useEffect(() => {
    const handleAvatarUpdate = (
      event: Event
    ) => {
      const detail =
        (event as CustomEvent<{
          avatarUrl: string | null;
          avatarName?: string | null;
        }>).detail;
      if (!detail) return;
      setAvatarUrl(detail.avatarUrl || null);
      setAvatarLabel(detail.avatarName || "");
      setAvatarPreviewError(false);
    };
    window.addEventListener(STUDENT_AVATAR_UPDATED_EVENT, handleAvatarUpdate);
    return () => {
      window.removeEventListener(
        STUDENT_AVATAR_UPDATED_EVENT,
        handleAvatarUpdate
      );
    };
  }, []);

  const unitsById = useMemo(
    () =>
      units.reduce<Record<string, Unit>>((acc, unit) => {
        acc[unit.id] = unit;
        return acc;
      }, {}),
    [units]
  );

  const unitAttemptIndex = useMemo(
    () => buildUnitAttemptIndex(attempts),
    [attempts]
  );

  const recentAttempts = useMemo(() => attempts.slice(0, 3), [attempts]);

  const hasDiagnosticAttempt = useMemo(
    () => attempts.some((a) => a.quizType === "diagnostic"),
    [attempts]
  );

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
      return "Keep practicing in any unit. We will recommend a next step once you complete a quiz.";
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
    
  const recommendationReason = nextActivity?.reason || null;

  const difficultyIntent = useMemo(() => {
    const target = nextActivity?.difficultyTarget;
    if (target == null) return null;
    if (target < 0.45) return "We will keep things on the easier side for now.";
    if (target < 0.65) return "We are aiming for medium difficulty next.";
    return "Expect a more challenging follow-up to stretch this skill.";
  }, [nextActivity]);

  const recommendationRoutes = useMemo(() => {
    if (!nextActivity || !recommendedUnit) {
      return { pill: null, jump: null };
    }
    const base = `/units/${recommendedUnit.id}`;
    const sectionId =
      nextActivity.sectionId || recommendedSection?.id || null;

    const sectionRoute = (kind: "practice" | "mini_quiz") => {
      if (!sectionId) return base;
      const suffix = kind === "practice" ? "practice" : "mini-quiz";
      return `${base}/sections/${sectionId}/${suffix}`;
    };

    let pill: string | null = null;
    let jump: string | null = null;

    /**
     * Routing rules:
     * - The pill mirrors the suggested activity (mini quiz, diagnostic, etc.).
     * - The primary "Jump in" button nudges toward practice when
     *   the recommendation is a scored activity so the experience feels
     *   complementary rather than redundant.
     */
    switch (nextActivity.activity) {
      case "diagnostic":
        pill = `${base}/diagnostic`;
        jump = pill;
        break;
      case "unit_test":
        pill = `${base}/test`;
        jump = sectionRoute("practice");
        break;
      case "mini_quiz":
        pill = sectionRoute("mini_quiz");
        jump = sectionRoute("practice");
        break;
      case "practice":
        pill = sectionRoute("practice");
        jump = pill;
        break;
      default:
        pill = base;
        jump = base;
    }

    return { pill, jump };
  }, [nextActivity, recommendedUnit, recommendedSection]);

  const strugglingUnit = useMemo(() => {
    const threshold = 60;
    let match: { unit: Unit; mastery: number } | null = null;
    for (const unit of units) {
      const unitAttempts = unitAttemptIndex[unit.id]?.attempts ?? [];
      const hasDiagnosticRecord = unitAttempts.some(
        (attempt) => attempt.quizType === "diagnostic"
      );
      if (!hasDiagnosticRecord) continue;
      const masteryValue = calcMasteryScore(unitAttempts);
      if (masteryValue < threshold) {
        if (!match || masteryValue < match.mastery) {
          match = { unit, mastery: masteryValue };
        }
      }
    }
    return match;
  }, [unitAttemptIndex, units]);

  const firstDiagnosticUnit = useMemo(
    () => units.find((unit) => unit.diagnosticQuizId),
    [units]
  );

  const firstDiagnosticRoute = firstDiagnosticUnit
    ? `/units/${firstDiagnosticUnit.id}/diagnostic`
    : null;

  const nextStepSuggestion: NextStepSuggestion = useMemo(() => {
    if (attempts.length === 0) {
      if (firstDiagnosticUnit && firstDiagnosticRoute) {
        return {
          description: `No activity yet. Start by taking your first diagnostic for ${firstDiagnosticUnit.title}.`,
          ctaLabel: "Take diagnostic",
          ctaRoute: firstDiagnosticRoute,
        };
      }
      return {
        description: "No activity yet. Start by taking your first diagnostic.",
        ctaLabel: "Browse units",
        ctaRoute: "/units",
      };
    }
    if (strugglingUnit) {
      const nextSection =
        strugglingUnit.unit.sections.find((section) => section.miniQuizId) ||
        strugglingUnit.unit.sections.find((section) => section.practiceQuizId);
      const sectionRoute = nextSection
        ? `/units/${strugglingUnit.unit.id}/sections/${nextSection.id}/${nextSection.miniQuizId ? "mini-quiz" : "practice"}`
        : `/units/${strugglingUnit.unit.id}`;
      return {
        description: `Suggested next step: Review your diagnostic results for ${strugglingUnit.unit.title} and practice a mini quiz.`,
        helper: `Mastery is ${strugglingUnit.mastery}% in this unit.`,
        ctaLabel: "Review diagnostic",
        ctaRoute: `/diagnostic-results/${strugglingUnit.unit.id}`,
        secondary: {
          label: "Practice mini quiz",
          route: sectionRoute,
        },
      };
    }
    if (!hasDiagnosticAttempt && firstDiagnosticUnit && firstDiagnosticRoute) {
      return {
        description: `Suggested next step: Take your first diagnostic for ${firstDiagnosticUnit.title}.`,
        ctaLabel: "Start diagnostic",
        ctaRoute: firstDiagnosticRoute,
      };
    }
    if (recommendationRoutes.jump) {
      return {
        description:
          "Suggested next step: Continue with your next recommended activity.",
        ctaLabel: "Open recommendation",
        ctaRoute: recommendationRoutes.jump,
      };
    }
    return {
      description: "Suggested next step: Continue practicing in any unit you like.",
      ctaLabel: "Browse units",
      ctaRoute: "/units",
    };
  }, [
    attempts,
    firstDiagnosticRoute,
    firstDiagnosticUnit,
    hasDiagnosticAttempt,
    recommendationRoutes.jump,
    strugglingUnit,
  ]);

  const isFirstRun = attempts.length === 0;
  const avatarInitials = useMemo(() => {
    const source = studentName || "BB";
    const initials = source
      .split(" ")
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
    return initials.slice(0, 2) || "BB";
  }, [studentName]);
  const avatarImageUrl = useMemo(
    () => toAvatarImageUrl(avatarUrl ?? null),
    [avatarUrl]
  );
  const showAvatarImage = Boolean(avatarImageUrl && !avatarPreviewError);
  const secondarySuggestion = nextStepSuggestion.secondary;

  if (loading) {
    return (
      <div className="page">
        <div className="card hero home-hero home-hero-loading">
          <div className="home-hero-text">
            <p className="muted small">Loading your dashboard…</p>
            <h2 className="u-my-8">Hang tight</h2>
            <p className="muted small">
              We are fetching your latest attempts and recommendations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card state-card state-card-error">
          <p className="error-text">{error}</p>
          <p className="muted small">
            We could not load your data right now. Please try again.
          </p>
          <button className="btn" onClick={handleRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card hero home-hero home-hero-balanced">
        <div className="home-hero-copy">
          <p className="muted small">Welcome back</p>
          <h1 className="u-mb-8">{studentName} 👋</h1>
          <p>
            Keep up the great work. You are making solid progress in Grade 9
            math.
          </p>
        </div>
        <div className="home-hero-avatar">
          <div className="home-hero-avatar-frame">
            {showAvatarImage ? (
              <img
                src={avatarImageUrl || ""}
                alt={avatarLabel || "Avatar preview"}
                onError={() => setAvatarPreviewError(true)}
              />
            ) : (
              <div className="avatar-default avatar-default-large">
                <span>{avatarInitials}</span>
              </div>
            )}
          </div>
          <div className="home-hero-mastery">
            <span className="muted tiny helper-text">Mastery</span>
            <strong>{overallMastery}%</strong>
          </div>
        </div>
      </div>

      {isFirstRun && (
        <div className="card onboarding-card">
          <div>
            <p className="muted small">New to BitByBit?</p>
            <h3>Welcome, let's get you started</h3>
            <p className="muted small">
              Start with a quick diagnostic so we can place you at the right level.
            </p>
          </div>
          <button
            className="btn primary"
            disabled={!firstDiagnosticRoute}
            onClick={() => {
              if (firstDiagnosticRoute) {
                nav(firstDiagnosticRoute);
              } else {
                nav("/units");
              }
            }}
          >
            Take your first diagnostic
          </button>
        </div>
      )}

      <div className="card recommendation-card">
        <div>
          <p className="muted small">Recommended next step 🎯</p>
          <h3 className="u-mt-4 u-mb-6">
            {recommendedUnit?.title || "Personalized learning"}
          </h3>
          <p className="muted small">{recommendationDescription}</p>
          {recommendationReason && (
            <p className="muted tiny helper-text">{recommendationReason}</p>
          )}
          {difficultyIntent && (
            <p className="muted tiny helper-text">{difficultyIntent}</p>
          )}
        </div>
        <div className="recommendation-actions">
          {recommendationBadge && (
            <button
              type="button"
              className="badge badge-recommend badge-link"
              disabled={!recommendationRoutes.pill}
              onClick={() => {
                if (recommendationRoutes.pill) {
                  nav(recommendationRoutes.pill);
                }
              }}
            >
              {recommendationBadge}
            </button>
          )}
          <button
            className="btn primary"
            disabled={!recommendationRoutes.jump}
            onClick={() => {
              if (recommendationRoutes.jump) {
                nav(recommendationRoutes.jump);
              }
            }}
          >
            Jump in
          </button>
        </div>
      </div>

      <div className="home-activity-grid">
        <div className="card suggestion-card">
          <div>
            <p className="muted small">Suggested next step</p>
            <h3 className="u-my-4">Keep your momentum</h3>
            <p className="muted small">{nextStepSuggestion.description}</p>
          </div>
          <div className="suggestion-actions">
            <button
              className="btn primary"
              onClick={() => nav(nextStepSuggestion.ctaRoute)}
            >
              {nextStepSuggestion.ctaLabel}
            </button>
            {secondarySuggestion && (
              <button
                className="btn secondary"
                onClick={() => nav(secondarySuggestion.route)}
              >
                {secondarySuggestion.label}
              </button>
            )}
          </div>
          {nextStepSuggestion.helper && (
            <p className="muted tiny helper-text">{nextStepSuggestion.helper}</p>
          )}
        </div>
        <div className="card recent-activity-card">
          <div className="card-head">
            <div>
              <p className="muted small">Recent activity</p>
              <h3 className="u-my-4">Last three attempts</h3>
            </div>
          </div>
          {recentAttempts.length === 0 ? (
            <p className="muted small">
              No recent activity yet. Start by taking a diagnostic.
            </p>
          ) : (
            <ul className="recent-activity-list">
              {recentAttempts.map((attempt) => {
                const unitTitle =
                  unitsById[attempt.unitId]?.title || "Unknown unit";
                return (
                  <li key={attempt.id}>
                    <div>
                      <strong>
                        {describeRecentAttempt(attempt, unitTitle)}
                      </strong>
                      <p className="muted small">
                        {formatRecentAttemptDate(attempt.createdAt)}
                      </p>
                    </div>
                    <span className="recent-activity-score">
                      {attempt.scorePct != null ? `${attempt.scorePct}%` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
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
          <p className="muted small">
            Based on your quizzes so far{" "}
            <span
              className="helper-hint inline"
              title="Mastery is a score from 0 to 1 (shown here as a percent) estimated from recent mini quizzes and unit tests."
            >
              i
            </span>
          </p>
          <span className="mastery-value">{overallMastery}%</span>
        </div>
      </div>

      <div className="dashboard-columns">
        <div className="card topic-card">
          <div className="card-head">
            <div>
              <h3>Topic mastery</h3>
              <p className="muted small">
                Track your progress across every unit.{" "}
                <span
                  className="helper-hint inline"
                  title="Mastery is a score from 0 to 1 (shown as a percent) estimated from past graded attempts in each unit."
                >
                  i
                </span>
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
                  <progress
                    className="progress-bar"
                    max={100}
                    value={t.avg}
                    aria-valuenow={t.avg}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card streak-card">
          <div>
            <h3>Learning streak 🔥</h3>
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

function formatRecentAttemptDate(createdAt?: number) {
  if (!createdAt) return "—";
  const millis = createdAt < 10_000_000_000 ? createdAt * 1000 : createdAt;
  const date = new Date(millis);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function describeRecentAttempt(attempt: AttemptRecord, unitTitle: string) {
  switch (attempt.quizType) {
    case "diagnostic":
      return `Completed diagnostic for ${unitTitle}`;
    case "mini_quiz":
      return `Mini quiz in ${unitTitle}`;
    case "unit_test":
      return `Unit test for ${unitTitle}`;
    case "practice":
      return `Practice session in ${unitTitle}`;
    default:
      return `Quiz in ${unitTitle}`;
  }
}
