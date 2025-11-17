import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  forgotPassword,
  login as loginRequest,
  setCurrentUser,
} from "../../../lib/authClient";
import {
  persistViewMode,
  type ViewMode,
} from "../../../lib/viewMode";
import {
  setCurrentStudentId,
  clearCurrentStudentId,
} from "../../../lib/currentStudent";

type Props = {
  currentUser: { role: ViewMode } | null;
};

const ROLE_HINTS: Record<ViewMode, string> = {
  student: "Students see personalized practice, mastery, and streak insights.",
  teacher: "Teachers monitor class progress, mastery, and focus areas.",
};

export default function LoginPage({ currentUser }: Props) {
  const nav = useNavigate();
  const [audience, setAudience] = useState<ViewMode>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotState, setForgotState] = useState<
    "idle" | "loading" | "sent" | "error"
  >("idle");

  useEffect(() => {
    if (currentUser) {
      nav(currentUser.role === "teacher" ? "/teacher" : "/", { replace: true });
    }
  }, [currentUser, nav]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const user = await loginRequest(email, password);
      setCurrentUser(user);
      if (user.role === "student") {
        persistViewMode("student");
        if (user.student_id) {
          setCurrentStudentId(user.student_id);
        } else {
          clearCurrentStudentId();
        }
        nav("/", { replace: true });
      } else {
        persistViewMode("teacher");
        nav("/teacher", { replace: true });
      }
    } catch (err) {
      console.error("Login failed", err);
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email so we know where to send reset instructions.");
      return;
    }
    try {
      setForgotState("loading");
      setError(null);
      await forgotPassword(email);
      setForgotState("sent");
    } catch (err) {
      console.warn("Forgot password failed", err);
      setForgotState("error");
      setError("Unable to process reset right now. Please try later.");
    } finally {
      setTimeout(() => setForgotState("idle"), 4000);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <p className="muted small">Welcome back</p>
        <h1>Sign in to BitByBit</h1>
        <div className="login-toggle" role="tablist">
          {(["student", "teacher"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              role="tab"
              className={`login-toggle-btn${
                audience === mode ? " active" : ""
              }`}
              type="button"
              onClick={() => setAudience(mode)}
            >
              {mode === "student" ? "Student" : "Teacher"}
            </button>
          ))}
        </div>
        <p className="muted small login-hint">{ROLE_HINTS[audience]}</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                audience === "teacher"
                  ? "teacher@example.com"
                  : "student@example.com"
              }
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button
            className="btn primary login-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <button
          className="btn-link login-forgot"
          type="button"
          onClick={handleForgotPassword}
        >
          Forgot password?
        </button>
        {forgotState === "sent" && (
          <p className="muted small">
            If this email exists, we will send reset instructions shortly.
          </p>
        )}
        {forgotState === "loading" && (
          <p className="muted small">Sending reset link…</p>
        )}

        <p className="muted small login-footnote">
          Demo accounts:
          <br />
          <strong>student@example.com</strong> · <code>password123</code>
          <br />
          <strong>teacher@example.com</strong> · <code>password123</code>
        </p>
      </div>
    </div>
  );
}
