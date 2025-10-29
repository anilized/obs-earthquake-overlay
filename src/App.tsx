import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Overlay from './pages/Overlay'
import Settings from './pages/Settings'
import Admin from './pages/Admin'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/overlay" replace />} />
        <Route path="/overlay" element={<Overlay />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </HashRouter>
  )
}
