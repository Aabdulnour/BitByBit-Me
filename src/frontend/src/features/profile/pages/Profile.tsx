import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchStudentState,
  updateStudentState,
} from "../../../lib/studentClient";
import { fetchAttempts } from "../../../lib/historyClient";
import { normalizeAttempts } from "../../../lib/attempts";
import { UnitsAPI, type Unit } from "../../units/services/unitsAPI";
import type { AttemptRecord } from "../../../types/attempts";
import {
  calcMasteryScore,
  classifyPlacement,
  filterAttemptsByType,
} from "../../units/utils/progress";

type StudentState = {
  name?: string;
  grade_level?: string;
  preferred_difficulty?: string;
};

const defaultState: StudentState = {
  name: "",
  grade_level: "",
  preferred_difficulty: "medium",
};

function computeDayStreak(attempts: AttemptRecord[]): number {
  /**
   * Simple current streak: counts consecutive days with attempts ending at today.
   */
  if (attempts.length === 0) return 0;
  const daySet = new Set(
    attempts
      .filter((a) => a.createdAt)
      .map((a) => {
        const d = new Date((a.createdAt as number) * 1000);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      })
  );
  if (daySet.size === 0) return 0;
  let streak = 0;
  const today = new Date();
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (daySet.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function deriveEmail(name?: string) {
  if (!name) return "student@example.edu";
  const handle = name.toLowerCase().replace(/\s+/g, ".");
  return `${handle}@example.edu`;
}

export default function ProfilePage() {
  const nav = useNavigate();
  const [student, setStudent] = useState<StudentState>(defaultState);
  const [form, setForm] = useState<StudentState>(defaultState);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const [studentData, attemptData, unitData] = await Promise.all([
          fetchStudentState(),
          fetchAttempts(),
          UnitsAPI.listUnits(),
        ]);
        if (!mounted) return;
        setStudent(studentData);
        setForm({
          name: studentData?.name ?? "",
          grade_level: studentData?.grade_level ?? "",
          preferred_difficulty: studentData?.preferred_difficulty ?? "medium",
        });
        setAttempts(normalizeAttempts(attemptData || []));
        setUnits(unitData);
      } catch (err) {
        console.error("Failed to load profile", err);
        if (mounted) {
          setLoadError("Could not load profile. Please try again later.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function handleChange(
    field: keyof StudentState,
    value: string
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setStatus("saving");
      setFormError(null);
      const patch = {
        name: form.name,
        grade_level: form.grade_level,
        preferred_difficulty: form.preferred_difficulty,
      };
      const updated = await updateStudentState(patch);
      const nextState = {
        ...student,
        ...(updated || patch),
      };
      setStudent(nextState);
      setForm({
        name: nextState.name ?? "",
        grade_level: nextState.grade_level ?? "",
        preferred_difficulty: nextState.preferred_difficulty ?? "medium",
      });
      setStatus("success");
      setFormError(null);
    } catch (err) {
      console.error("Failed to update profile", err);
      setStatus("error");
      setFormError("Unable to save changes. Please try again.");
    }
  }

  const masteryAttempts = useMemo(
    () => filterAttemptsByType(attempts, ["mini_quiz", "unit_test"]),
    [attempts]
  );

  const questionsCompleted = attempts.reduce(
    (sum, attempt) => sum + attempt.results.length,
    0
  );
  const distinctUnits = new Set(masteryAttempts.map((a) => a.unitId));
  const overallMastery = calcMasteryScore(attempts);
  const dayStreak = computeDayStreak(attempts);
  const bestScore = attempts.reduce(
    (max, attempt) => Math.max(max, attempt.scorePct || 0),
    0
  );

  const placementByUnit = useMemo(() => {
    const map: Record<string, string> = {};
    for (const attempt of attempts) {
      if (attempt.quizType !== "diagnostic" || !attempt.unitId) continue;
      if (map[attempt.unitId]) continue;
      const placement = classifyPlacement(attempt.scorePct);
      if (placement) {
        map[attempt.unitId] = placement;
      }
    }
    return map;
  }, [attempts]);

  const unitMastery = useMemo(() => {
    return units.map((unit) => {
      const records = filterAttemptsByType(
        attempts.filter((a) => a.unitId === unit.id),
        ["mini_quiz", "unit_test"]
      );
      const avg = records.length
        ? Math.round(
            records.reduce((sum, attempt) => sum + (attempt.scorePct || 0), 0) /
              records.length
          )
        : 0;
      return {
        id: unit.id,
        title: unit.title,
        avg,
        placement: placementByUnit[unit.id],
        questions: records.reduce(
          (sum, attempt) => sum + attempt.results.length,
          0
        ),
      };
    });
  }, [units, attempts, placementByUnit]);

  const hintUsageByUnit = useMemo(() => {
    const map: Record<string, number> = {};
    for (const attempt of attempts) {
      if (!attempt.unitId) continue;
      if (attempt.results.some((r) => r.usedHint)) {
        map[attempt.unitId] = (map[attempt.unitId] || 0) + 1;
      }
    }
    return map;
  }, [attempts]);

  const focusAreas = useMemo(() => {
    /**
     * Flag areas where mastery is low (<70%) and hints are used frequently (>=2).
     */
    return unitMastery
      .filter((unit) => {
        const hintCount = hintUsageByUnit[unit.id] ?? 0;
        return unit.avg < 70 && hintCount >= 2;
      })
      .map((unit) => ({
        id: unit.id,
        title: unit.title,
        hintCount: hintUsageByUnit[unit.id] ?? 0,
      }));
  }, [unitMastery, hintUsageByUnit]);

  const algebraMastery = unitMastery.find((u) => u.id === "algebra-1")?.avg ?? 0;

  const badges = useMemo(() => {
    const list = [
      {
        id: "first-steps",
        name: "First steps",
        icon: "🚀",
        description: "Complete your first practice session",
        unlocked: attempts.length >= 1,
        progress: `${Math.min(attempts.length, 1)}/1 sessions`,
        goal: "Complete one practice session.",
      },
      {
        id: "quick-learner",
        name: "Quick learner",
        icon: "⚡️",
        description: "Score 100% on any quiz",
        unlocked: attempts.some((a) => a.scorePct >= 100),
        progress: `Best score: ${bestScore}%`,
        goal: "Earn a perfect score on any quiz.",
      },
      {
        id: "week-warrior",
        name: "Week warrior",
        icon: "🔥",
        description: "Maintain a 7-day streak",
        unlocked: dayStreak >= 7,
        progress: `${Math.min(dayStreak, 7)}/7 days`,
        goal: "Keep a 7-day streak going.",
      },
      {
        id: "master-algebra",
        name: "Master of Algebra",
        icon: "📐",
        description: "Achieve 90%+ mastery in Algebra Basics",
        unlocked: algebraMastery >= 90,
        progress: `${algebraMastery}% mastery`,
        goal: "Reach 90% mastery in Algebra Basics.",
      },
      {
        id: "geometry-genius",
        name: "Geometry genius",
        icon: "🧠",
        description: "Complete all geometry sections",
        unlocked: false,
        progress: "Coming soon",
        goal: "Score 80%+ on upcoming geometry content.",
      },
    ];
    return {
      list,
      unlocked: list.filter((badge) => badge.unlocked).length,
    };
  }, [attempts, dayStreak, algebraMastery, bestScore]);

  const nextMilestone = useMemo(() => {
    if (dayStreak < 7) {
      return {
        title: "Build a 7-day streak",
        subtitle: `${Math.max(7 - dayStreak, 0)} more day(s) to unlock Week warrior.`,
        cta: "/units",
        ctaLabel: "Start practice",
      };
    }
    return {
      title: "Push Algebra mastery to 90%",
      subtitle: `You're at ${algebraMastery}% — review Algebra Basics to earn Master of Algebra.`,
      cta: "/units/algebra-1",
      ctaLabel: "Review Algebra",
    };
  }, [dayStreak, algebraMastery]);

  if (loading) {
    return (
      <div className="page">
        <div className="empty">Loading profile…</div>
      </div>
    );
  }

  return (
    <div className="page profile-page">
      <div className="page-header">
        <div>
          <h1>Profile</h1>
          <p className="muted">
            Update your details, track mastery, and celebrate milestones.
          </p>
        </div>
        <div className="hero-actions">
          <button className="btn" onClick={() => nav("/")}>
            View dashboard
          </button>
        </div>
      </div>

      {loadError && <div className="empty">{loadError}</div>}

      <div className="card profile-hero-card">
        <div className="profile-hero-info">
          <div className="avatar-card profile-avatar-card">
            <div className="avatar-shell profile-avatar-shell">
              {/* TODO: Replace this placeholder with Ready Player Me avatar embed */}
              <span>Your avatar</span>
            </div>
            <p className="muted small">Link your Ready Player Me look soon.</p>
          </div>
          <div className="profile-hero-details">
            <h2 style={{ margin: "0 0 4px" }}>
              {student.name || "Unknown student"}
            </h2>
            <p className="muted small">{deriveEmail(student.name)}</p>
            <span className="profile-master-value">{overallMastery}% mastery</span>
            <div className="profile-tags">
              <span className="tag profile-tag">
                {dayStreak} day streak
              </span>
              <span className="tag profile-tag">
                {badges.unlocked} badges earned
              </span>
            </div>
          </div>
        </div>
        <div className="profile-hero-meta">
          <div>
            <p className="muted small">Grade level</p>
            <strong>{student.grade_level || "Not set"}</strong>
          </div>
          <div>
            <p className="muted small">Preferred difficulty</p>
            <strong>
              {(student.preferred_difficulty || "medium").replace(/^\w/, (c) =>
                c.toUpperCase()
              )}
            </strong>
            <p className="muted small">
              Adaptive setting managed automatically
            </p>
          </div>
          <div>
            <p className="muted small">Best score</p>
            <strong>{bestScore}%</strong>
            <p className="muted small">Your top quiz so far</p>
          </div>
        </div>
      </div>

      <div className="card profile-highlight-card">
        <div>
          <p className="muted small">Next milestone</p>
          <h3 style={{ margin: "6px 0" }}>{nextMilestone.title}</h3>
          <p className="muted small">{nextMilestone.subtitle}</p>
        </div>
        <button className="btn primary" onClick={() => nav(nextMilestone.cta)}>
          {nextMilestone.ctaLabel}
        </button>
      </div>

      <div className="card focus-card">
        <div className="focus-card-head">
          <div>
            <p className="muted small">Focus areas 🎯</p>
            <h3 style={{ margin: "4px 0" }}>Where hints spike</h3>
          </div>
        </div>
        {focusAreas.length === 0 ? (
          <p className="muted small">
            You're not leaning on hints right now. Keep exploring confidence-building
            practice!
          </p>
        ) : (
          <div className="focus-list">
            {focusAreas.map((area) => (
              <div key={area.id} className="focus-item">
                <div className="focus-icon">🎯</div>
                <div>
                  <strong>{area.title}</strong>
                  <p className="muted small">
                    You often use hints here. Try another mini quiz or targeted practice to
                    boost mastery.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="profile-grid">
        <div className="card learning-card">
          <h3>Learning statistics 📊</h3>
          <div className="stat-grid">
            <div>
              <p className="muted small">Questions completed</p>
              <strong className="stat-value">{questionsCompleted}</strong>
            </div>
            <div>
              <p className="muted small">Topics explored</p>
              <strong className="stat-value">{distinctUnits.size}</strong>
            </div>
            <div>
              <p className="muted small">Badges earned</p>
              <strong className="stat-value">{badges.unlocked}</strong>
            </div>
            <div>
              <p className="muted small">Day streak</p>
              <strong className="stat-value">{dayStreak}</strong>
            </div>
          </div>

          <div className="topic-breakdown">
            <h4>Topic mastery breakdown</h4>
            {unitMastery.map((unit) => (
              <div key={unit.id} className="topic-breakdown-row">
                <div className="topic-info">
                  <strong>{unit.title}</strong>
                  <span className="muted small">
                    {unit.questions} questions
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${unit.avg}%` }}
                  />
                </div>
                <div className="topic-meta">
                  <span className="muted small">{unit.avg}%</span>
                  {unit.placement && (
                    <span className="placement-tag">{unit.placement}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card badges-card">
          <h3>Badges 🏅</h3>
          <div className="badge-list">
            {badges.list.map((badge) => (
              <div
                key={badge.id}
                className={`badge-item ${badge.unlocked ? "unlocked" : ""}`}
              >
                <div className="badge-icon">{badge.icon}</div>
                <div>
                  <strong>{badge.name}</strong>
                  <p className="muted small">{badge.description}</p>
                  <span
                    className={`badge-status ${
                      badge.unlocked ? "earned" : ""
                    }`}
                  >
                    {badge.unlocked ? "Unlocked" : badge.progress}
                  </span>
                  {!badge.unlocked && badge.goal && (
                    <p className="badge-goal">{badge.goal}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <form className="card form-card" onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>Edit profile</h2>
        <div className="form-grid">
          <label>
            <span>Full name</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Enter your name"
            />
          </label>
          <label>
            <span>Grade level</span>
            <input
              className="input"
              value={form.grade_level}
              onChange={(e) => handleChange("grade_level", e.target.value)}
              placeholder="Grade 9"
            />
          </label>
        </div>
        <p className="muted small">
          Difficulty will adapt automatically soon. Sit tight—we will tune it
          based on your mastery data.
        </p>
        <div className="form-actions">
          <button
            className="btn primary"
            type="submit"
            disabled={status === "saving"}
          >
            {status === "saving" ? "Saving…" : "Save changes"}
          </button>
          {status === "success" && (
            <span className="form-status success">Changes saved!</span>
          )}
          {formError && <span className="form-status error">{formError}</span>}
        </div>
      </form>
    </div>
  );
}
