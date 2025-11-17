import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  readStoredViewMode,
  VIEW_MODE_EVENT,
  type ViewMode,
  clearStoredViewMode,
} from "../lib/viewMode";
import { clearCurrentUser } from "../lib/authClient";
import { clearCurrentStudentId } from "../lib/currentStudent";

interface Props {
  children?: React.ReactNode;
  userRole?: ViewMode;
}

export default function AppShell({ children, userRole }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("student");
  const nav = useNavigate();

  useEffect(() => {
    const syncMode = () => {
      setViewMode(readStoredViewMode());
    };
    syncMode();
    window.addEventListener("storage", syncMode);
    window.addEventListener(VIEW_MODE_EVENT as any, syncMode as EventListener);
    return () => {
      window.removeEventListener("storage", syncMode);
      window.removeEventListener(
        VIEW_MODE_EVENT as any,
        syncMode as EventListener
      );
    };
  }, []);

  const effectiveMode: ViewMode =
    userRole === "teacher" ? viewMode : "student";
  const isTeacherMode = effectiveMode === "teacher";
  const navLinks = isTeacherMode
    ? [
        { to: "/teacher", label: "Teacher dashboard" },
      ]
    : [
        { to: "/", label: "Home", end: true },
        { to: "/units", label: "Units" },
        { to: "/history", label: "History" },
        { to: "/profile", label: "Profile" },
      ];

  const handleSignOut = () => {
    clearCurrentUser();
    clearCurrentStudentId();
    clearStoredViewMode();
    nav("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">BitByBit</span>
          <span className="view-mode-pill">
            {isTeacherMode ? "Teacher mode" : "Student mode"}
          </span>
        </div>
        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            ⚙️ Settings
          </NavLink>
          <button
            type="button"
            className="nav-link nav-link-ghost"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
