import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomeDashboard from './features/home/pages/HomeDashboard'
import UnitsPage from './features/units/pages/Units'
import UnitDetailPage from './features/units/pages/UnitDetail'
import DiagnosticPage from './features/units/pages/Diagnostic'
import UnitTestPage from './features/units/pages/UnitTest'
import PracticePage from './features/units/pages/Practice'
import MiniQuizPage from './features/units/pages/MiniQuiz'
import HistoryPage from './features/history/pages/History'
import ProfilePage from './features/profile/pages/Profile'
import SettingsPage from './features/settings/pages/Settings'
import TeacherDashboard from './features/teacher/pages/TeacherDashboard'
import AppShell from './layout/AppShell'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app-root">
        <AppShell>
          <Routes>
            <Route path="/" element={<HomeDashboard />} />
            <Route path="/units" element={<UnitsPage />} />
            <Route path="/units/:unitId" element={<UnitDetailPage />} />
            <Route path="/units/:unitId/diagnostic" element={<DiagnosticPage />} />
            <Route path="/units/:unitId/test" element={<UnitTestPage />} />
            <Route path="/units/:unitId/sections/:sectionId/practice" element={<PracticePage />} />
            <Route path="/units/:unitId/sections/:sectionId/mini-quiz" element={<MiniQuizPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </div>
    </BrowserRouter>
  )
}

export default App
