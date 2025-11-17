import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import HomeDashboard from './features/home/pages/HomeDashboard'
import UnitsPage from './features/units/pages/Units'
import UnitDetailPage from './features/units/pages/UnitDetail'
import DiagnosticPage from './features/units/pages/Diagnostic'
import DiagnosticResultsPage from './features/units/pages/DiagnosticResults'
import UnitTestPage from './features/units/pages/UnitTest'
import PracticePage from './features/units/pages/Practice'
import MiniQuizPage from './features/units/pages/MiniQuiz'
import HistoryPage from './features/history/pages/History'
import ProfilePage from './features/profile/pages/Profile'
import SettingsPage from './features/settings/pages/Settings'
import TeacherDashboard from './features/teacher/pages/TeacherDashboard'
import LoginPage from './features/auth/pages/Login'
import AppShell from './layout/AppShell'
import { AUTH_EVENT, getCurrentUser } from './lib/authClient'
import './App.css'

function RequireAuth({ user }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return (
    <AppShell userRole={user.role}>
      <Outlet />
    </AppShell>
  )
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser())

  useEffect(() => {
    const sync = () => setCurrentUser(getCurrentUser())
    window.addEventListener('storage', sync)
    window.addEventListener(AUTH_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(AUTH_EVENT, sync)
    }
  }, [])

  return (
    <BrowserRouter>
      <div className="app-root">
        <Routes>
          <Route path="/login" element={<LoginPage currentUser={currentUser} />} />
          <Route element={<RequireAuth user={currentUser} />}>
            <Route path="/" element={<HomeDashboard />} />
            <Route path="/units" element={<UnitsPage />} />
            <Route path="/units/:unitId" element={<UnitDetailPage />} />
            <Route path="/units/:unitId/diagnostic" element={<DiagnosticPage />} />
            <Route path="/units/:unitId/test" element={<UnitTestPage />} />
            <Route path="/units/:unitId/sections/:sectionId/practice" element={<PracticePage />} />
            <Route path="/units/:unitId/sections/:sectionId/mini-quiz" element={<MiniQuizPage />} />
            <Route path="/diagnostic-results/:unitId" element={<DiagnosticResultsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
