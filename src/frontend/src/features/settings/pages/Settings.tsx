import React, { useState } from "react";
import {
  persistViewMode,
  readStoredViewMode,
  type ViewMode,
} from "../../../lib/viewMode";

const MODE_DESCRIPTIONS: Record<ViewMode, string> = {
  student: "Personalized practice, mastery tracking, and hints tuned to you.",
  teacher: "Teacher view shows class level progress and focus areas.",
};

export default function SettingsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readStoredViewMode());

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    persistViewMode(mode);
  };

  return (
    <div className="page settings-page">
      <div className="card settings-card">
        <h1 style={{ marginTop: 0 }}>Settings</h1>
        <section className="settings-section">
          <h3>View mode</h3>
          <p className="muted small">
            Preview upcoming modes for students and teachers.
          </p>
          <div className="settings-options">
            <label className="settings-option">
              <input
                type="radio"
                name="view-mode"
                value="student"
                checked={viewMode === "student"}
                onChange={() => handleModeChange("student")}
              />
              <div>
                <strong>Student view</strong>
                <p className="muted small">
                  {MODE_DESCRIPTIONS.student}
                </p>
              </div>
            </label>
            <label className="settings-option">
              <input
                type="radio"
                name="view-mode"
                value="teacher"
                checked={viewMode === "teacher"}
                onChange={() => handleModeChange("teacher")}
              />
              <div>
                <strong>Teacher view (coming soon)</strong>
                <p className="muted small">
                  {MODE_DESCRIPTIONS.teacher}
                </p>
                <p className="muted small">
                  Use this mode to preview what a teacher dashboard could look like.
                </p>
              </div>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
