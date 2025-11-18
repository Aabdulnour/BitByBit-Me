import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  READY_PLAYER_ME_URL,
  STUDENT_AVATAR_UPDATED_EVENT,
  toAvatarImageUrl,
} from "../../../constants/avatar";

type StudentState = {
  name?: string;
  grade_level?: string;
  preferred_difficulty?: string;
  avatar_url?: string | null;
  avatar_name?: string | null;
};

const defaultState: StudentState = {
  name: "",
  grade_level: "",
  preferred_difficulty: "medium",
  avatar_url: null,
  avatar_name: null,
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
  const [avatarUrlDraft, setAvatarUrlDraft] = useState("");
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "saving">("idle");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [isAvatarEditorLoading, setIsAvatarEditorLoading] = useState(false);
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const avatarEditorFrameRef = useRef<HTMLIFrameElement | null>(null);
  const hasSubscribedToAvatarExport = useRef(false);

  const readyPlayerMeOrigin = useMemo(() => {
    try {
      return new URL(READY_PLAYER_ME_URL).origin;
    } catch {
      return "";
    }
  }, []);

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
        const normalizedState: StudentState = {
          ...studentData,
          avatar_url: studentData?.avatar_url ?? null,
          avatar_name: studentData?.avatar_name ?? null,
        };
        setStudent(normalizedState);
        setForm({
          name: normalizedState?.name ?? "",
          grade_level: normalizedState?.grade_level ?? "",
          preferred_difficulty: normalizedState?.preferred_difficulty ?? "medium",
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

  useEffect(() => {
    setAvatarImageError(false);
  }, [student.avatar_url]);

  useEffect(() => {
    if (!isAvatarSaving) return;
    const timeout = window.setTimeout(() => {
      setIsAvatarSaving(false);
    }, 10000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [isAvatarSaving]);

  useEffect(() => {
    setAvatarUrlDraft(student.avatar_url || "");
  }, [student.avatar_url]);

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
      const nextState: StudentState = {
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

  const openAvatarEditor = () => {
    setAvatarError(null);
    setAvatarMessage(null);
    setIsAvatarEditorOpen(true);
    setIsAvatarEditorLoading(true);
    setAvatarImageError(false);
    hasSubscribedToAvatarExport.current = false;
  };

  const closeAvatarEditor = () => {
    setIsAvatarEditorOpen(false);
    setIsAvatarEditorLoading(false);
    setIsAvatarSaving(false);
    hasSubscribedToAvatarExport.current = false;
  };

  const persistAvatarChange = useCallback(
    async ({
      avatarUrl,
      avatarName,
      source,
      closeEditorOnSuccess = false,
    }: {
      avatarUrl: string | null;
      avatarName?: string | null;
      source: "rpm" | "override";
      closeEditorOnSuccess?: boolean;
    }) => {
      setAvatarStatus("saving");
      setAvatarError(null);
      setAvatarMessage(null);
      try {
        const patch: { avatar_url: string | null; avatar_name?: string | null } =
          {
            avatar_url: avatarUrl,
          };
        if (avatarName !== undefined) {
          patch.avatar_name = avatarName;
        }
        const updated = await updateStudentState(patch);
        const merged = {
          ...(updated || patch),
        };
        setStudent((prev) => ({ ...prev, ...merged }));
        const nextStoredUrl =
          typeof merged.avatar_url === "string"
            ? merged.avatar_url
            : avatarUrl || null;
        setAvatarUrlDraft(nextStoredUrl || "");
        const finalAvatarName =
          (merged.avatar_name ?? avatarName ?? null) || null;
        const successCopy = nextStoredUrl
          ? source === "rpm"
            ? "Avatar updated from Ready Player Me."
            : "Avatar saved."
          : "Avatar cleared. We will fall back to initials until you save a new one.";
        setAvatarMessage(successCopy);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(STUDENT_AVATAR_UPDATED_EVENT, {
              detail: {
                avatarUrl: nextStoredUrl,
                avatarName: finalAvatarName,
                source,
              },
            })
          );
        }
        if (closeEditorOnSuccess) {
          setIsAvatarEditorOpen(false);
          setIsAvatarEditorLoading(false);
        }
        return true;
      } catch (err) {
        console.error("Failed to save avatar", err);
        setAvatarError(
          "We could not save your avatar right now. Please try again."
        );
        return false;
      } finally {
        setAvatarStatus("idle");
      }
    },
    []
  );

  const requestAvatarExport = useCallback(() => {
    if (!avatarEditorFrameRef.current?.contentWindow) {
      setAvatarError(
        "We could not reach the Ready Player Me editor. Please close and reopen."
      );
      return;
    }
    setAvatarError(null);
    setAvatarMessage(null);
    setIsAvatarSaving(true);
    avatarEditorFrameRef.current.contentWindow.postMessage(
      {
        target: "readyplayerme",
        type: "request",
        eventName: "v1.avatar.export",
      },
      "*"
    );
  }, []);

  async function handleAvatarUrlSave() {
    const trimmedValue = avatarUrlDraft.trim();
    await persistAvatarChange({
      avatarUrl: trimmedValue || null,
      source: "override",
    });
  }

  useEffect(() => {
    if (!isAvatarEditorOpen) return;

    const parseEventPayload = (raw: unknown) => {
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch (err) {
          console.warn("Unable to parse Ready Player Me message", err);
          return null;
        }
      }
      if (typeof raw === "object" && raw !== null) {
        return raw as Record<string, unknown>;
      }
      return null;
    };

    const subscribeToExportEvent = () => {
      if (hasSubscribedToAvatarExport.current) return;
      hasSubscribedToAvatarExport.current = true;
      avatarEditorFrameRef.current?.contentWindow?.postMessage(
        {
          target: "readyplayerme",
          type: "subscribe",
          eventName: "v1.avatar.exported",
        },
        "*"
      );
    };

    const handleReadyPlayerMeMessage = (event: MessageEvent) => {
      const data = parseEventPayload(event.data);
      if (!data) return;
      if (data?.source === "readyplayerme") {
        console.log("[RPM] raw message", data);
      }
      const messageSource =
        typeof data?.source === "string" ? data.source : null;
      const originMatches =
        typeof event.origin === "string" &&
        (event.origin.includes("readyplayer.me") ||
          (!!readyPlayerMeOrigin && event.origin === readyPlayerMeOrigin));
      if (messageSource !== "readyplayerme" || !originMatches) {
        return;
      }

      const eventName =
        typeof (data as Record<string, any>).eventName === "string"
          ? (data as Record<string, any>).eventName
          : null;
      if (!eventName) return;

      if (eventName === "v1.frame.ready") {
        setIsAvatarEditorLoading(false);
        subscribeToExportEvent();
        return;
      }

      const normalizedEvent = eventName.toLowerCase();
      const isExportEvent =
        normalizedEvent === "v1.avatar.exported" ||
        normalizedEvent === "v1.avatar.exported.v2" ||
        normalizedEvent.includes("avatar.export");

      if (isExportEvent) {
        setIsAvatarSaving(false);
        try {
          const normalizedData =
            typeof data === "object" && data !== null
              ? (data as Record<string, any>)
              : {};
          const payload =
            normalizedData?.data && typeof normalizedData.data === "object"
              ? (normalizedData.data as Record<string, any>)
              : {};
          const avatarPayload =
            payload?.avatar && typeof payload.avatar === "object"
              ? (payload.avatar as Record<string, any>)
              : normalizedData?.avatar && typeof normalizedData.avatar === "object"
              ? (normalizedData.avatar as Record<string, any>)
              : undefined;
          const candidateUrls = [
            payload?.url,
            payload?.avatarUrl,
            payload?.avatar_url,
            avatarPayload?.url,
            avatarPayload?.avatarUrl,
            avatarPayload?.avatar_url,
            normalizedData?.avatarUrl,
            normalizedData?.avatar_url,
            normalizedData?.avatar?.url,
            normalizedData?.avatar?.avatarUrl,
            normalizedData?.avatar?.avatar_url,
          ];
          const nextUrl = candidateUrls.find(
            (url): url is string =>
              typeof url === "string" && /^https?:\/\//.test(url)
          );
          if (!nextUrl) {
            console.warn("Ready Player Me message missing avatar URL", data);
            setAvatarError(
              "We could not get your avatar from Ready Player Me. Please try again."
            );
            return;
          }
          const candidateName =
            (avatarPayload &&
              (avatarPayload.name ||
                avatarPayload.displayName ||
                avatarPayload.avatar_name ||
                avatarPayload.avatarName ||
                avatarPayload?.meta?.displayName)) ||
            payload?.name;
          const nextName =
            typeof candidateName === "string" ? candidateName : undefined;
          void persistAvatarChange({
            avatarUrl: nextUrl,
            avatarName: nextName ?? null,
            source: "rpm",
            closeEditorOnSuccess: true,
          });
        } catch (err) {
          console.error("Failed to handle Ready Player Me export", err);
          setAvatarError(
            "We could not get your avatar from Ready Player Me. Please try again."
          );
        }
        return;
      }

      console.log("[RPM] unhandled event", eventName, data);
    };

    window.addEventListener("message", handleReadyPlayerMeMessage);
    return () => {
      window.removeEventListener("message", handleReadyPlayerMeMessage);
    };
  }, [isAvatarEditorOpen, persistAvatarChange, readyPlayerMeOrigin]);

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

  const rawAvatarUrl = student?.avatar_url ?? null;
  let avatarImageUrl: string | null = null;
  try {
    avatarImageUrl = toAvatarImageUrl(rawAvatarUrl);
  } catch (err) {
    console.warn("Unable to derive avatar image URL", err);
    avatarImageUrl = null;
  }

  if (loading) {
    return (
      <div className="page">
        <div className="empty">Loading profile…</div>
      </div>
    );
  }

  const hasAttempts = attempts.length > 0;
  const avatarInitials = (student.name || "BB")
    .split(" ")
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2) || "BB";
  const showAvatarImage = Boolean(avatarImageUrl && !avatarImageError);

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
          <button className="btn secondary" onClick={() => nav("/settings")}>
            Switch student
          </button>
          <button className="btn" onClick={() => nav("/")}>
            View dashboard
          </button>
        </div>
      </div>

      {loadError && <div className="empty">{loadError}</div>}

      <div className="card profile-header-card">
        <div className="profile-header-content">
          <div className="profile-header-avatar">
            <div
              className="profile-header-avatar-frame clickable-shell"
              onClick={openAvatarEditor}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openAvatarEditor();
                }
              }}
            >
              {showAvatarImage ? (
                <img
                  src={avatarImageUrl || ""}
                  alt={student.avatar_name || "Avatar preview"}
                  onError={() => setAvatarImageError(true)}
                />
              ) : (
                <div className="avatar-default avatar-default-large">
                  <span>{avatarInitials}</span>
                </div>
              )}
            </div>
            <button
              className="btn secondary"
              type="button"
              onClick={openAvatarEditor}
            >
              Edit avatar
            </button>
            {student.avatar_url && (
              <p className="muted tiny helper-text avatar-url-inline">
                {student.avatar_url}
              </p>
            )}
          </div>
        <div className="profile-header-info">
          <p className="muted small">Student profile</p>
          <h2 className="u-mt-0 u-mb-4">
            {student.name || "Unknown student"}
          </h2>
            <p className="muted small">{deriveEmail(student.name)}</p>
            <div className="profile-mastery-highlight">
              <span className="profile-master-value">
                {overallMastery}% mastery
              </span>
              <div className="profile-tags">
                <span className="tag profile-tag">{dayStreak} day streak</span>
                <span className="tag profile-tag">
                  {badges.unlocked} badges earned
                </span>
              </div>
            </div>
            <p className="muted small">
              Manage everything about your avatar and account from this page.
            </p>
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
          <h3 className="u-mt-6 u-mb-6">{nextMilestone.title}</h3>
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
            <h3 className="u-my-4">Where hints spike</h3>
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

          {!hasAttempts && (
            <p className="muted small profile-empty-note">
              You have not completed any quizzes yet. Start with a diagnostic in Units to
              unlock your stats.
            </p>
          )}

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
                <progress
                  className="progress-bar"
                  max={100}
                  value={unit.avg}
                  aria-valuenow={unit.avg}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
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

      <div className="card avatar-settings-card">
        <h2 className="u-mt-0">Avatar and profile settings</h2>
        <div className="avatar-preview-panel">
          {showAvatarImage ? (
            <img
              src={avatarImageUrl || ""}
              alt={student.avatar_name || "Avatar preview"}
              onError={() => setAvatarImageError(true)}
            />
          ) : (
            <div className="avatar-default avatar-default-large">
              <span>{avatarInitials}</span>
            </div>
          )}
        </div>
        <div className="avatar-url-section">
          <label>
            <span>Avatar URL (from Ready Player Me)</span>
            <input
              className="input"
              value={avatarUrlDraft}
              onChange={(e) => {
                setAvatarUrlDraft(e.target.value);
                setAvatarError(null);
                setAvatarMessage(null);
              }}
              placeholder="https://models.readyplayer.me/your-avatar.glb"
            />
          </label>
          <p className="muted tiny helper-text">
            Paste your Ready Player Me avatar link here and click Save.
          </p>
          <div className="avatar-url-actions">
            <button
              type="button"
              className="btn primary"
              onClick={handleAvatarUrlSave}
              disabled={avatarStatus === "saving"}
            >
              {avatarStatus === "saving" ? "Saving…" : "Save avatar"}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={openAvatarEditor}
            >
              Open Ready Player Me editor
            </button>
          </div>
          {avatarError && <p className="error-text">{avatarError}</p>}
          {avatarMessage && (
            <span className="form-status success">{avatarMessage}</span>
          )}
        </div>
        <form className="profile-settings-form" onSubmit={handleSubmit}>
          <h3>Profile basics</h3>
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


      {isAvatarEditorOpen && (
        <div className="avatar-editor-portal" role="dialog" aria-modal="true">
          <div
            className="avatar-editor-backdrop"
            onClick={closeAvatarEditor}
          />
          <div className="avatar-editor-modal">
            <div className="avatar-editor-header">
              <div>
                <h3 className="u-m-0">Avatar editor</h3>
                <p className="muted small u-m-0">
                  Powered by Ready Player Me.
                </p>
              </div>
            </div>
            <p className="muted tiny helper-text u-mt-0 u-mb-4">
              Use this editor to design your avatar. When you're done, copy the link and paste it into the Avatar URL field — or try <strong>Save avatar</strong> below to sync automatically.
            </p>
            {avatarError && (
              <p className="error-text u-mt-0 u-mb-4">
                {avatarError}
              </p>
            )}
            <div className="avatar-editor-body">
              {isAvatarEditorLoading && (
                <div className="avatar-editor-loading">
                  Loading avatar editor…
                </div>
              )}
              <iframe
                title="Ready Player Me avatar editor"
                src={READY_PLAYER_ME_URL}
                className="avatar-editor-frame"
                allow="camera *; microphone *; clipboard-write"
                onLoad={() => setIsAvatarEditorLoading(false)}
                ref={avatarEditorFrameRef}
              />
            </div>
            <div className="avatar-editor-actions">
              <button
                type="button"
                className="btn primary"
                onClick={requestAvatarExport}
                disabled={isAvatarEditorLoading || isAvatarSaving}
              >
                {isAvatarSaving ? "Saving avatar…" : "Save avatar"}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={closeAvatarEditor}
                disabled={isAvatarSaving}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
