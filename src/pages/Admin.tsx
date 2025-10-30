import React, { useEffect, useMemo, useState } from 'react'
import { applyTheme, defaultSettings, loadSettings, saveSettings } from '../lib/config'

function useAdminAuth() {
  const [ok, setOk] = useState<boolean>(() => {
    try { return sessionStorage.getItem('adminAuth') === '1' } catch { return false }
  })
  const login = (u: string, p: string) => {
    const user = (import.meta as any).env?.VITE_ADMIN_USER || 'admin'
    const pass = (import.meta as any).env?.VITE_ADMIN_PASS || 'change-me'
    if (u === user && p === pass) {
      try { sessionStorage.setItem('adminAuth', '1') } catch {}
      setOk(true)
      return true
    }
    return false
  }
  const logout = () => { try { sessionStorage.removeItem('adminAuth') } catch {}; setOk(false) }
  return { ok, login, logout }
}

export default function Admin() {
  const { ok, login, logout } = useAdminAuth()
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')

  const [s, setS] = useState(loadSettings)
  useEffect(() => { applyTheme(s.theme) }, [s.theme])

  const envDefault = useMemo(() => (import.meta as any).env?.VITE_EMSC_WS_URL || 'wss://www.seismicportal.eu/standing_order/websocket', [])

  const onSave = () => {
    const payload = { ...s, minMag: Number(s.minMag) || 0 }
    saveSettings(payload)
    alert('Saved. Overlay will reconnect if URL changed.')
  }

  if (!ok) {
    return (
      <div className="p-6 min-h-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100">
        <div className="max-w-sm mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Admin Login</h2>
          <div className="space-y-3">
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800" placeholder="Username" value={u} onChange={e=>setU(e.target.value)} />
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800" type="password" placeholder="Password" value={p} onChange={e=>setP(e.target.value)} />
            {err && <div className="text-rose-600 text-sm">{err}</div>}
            <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white" onClick={()=>{ setErr(''); if(!login(u,p)) setErr('Invalid credentials') }}>Login</button>
            <div className="text-xs text-gray-600 dark:text-gray-400">Note: Client-side check only. Set VITE_ADMIN_USER and VITE_ADMIN_PASS in env.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 min-h-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold tracking-tight">Admin Panel</h2>
          <button className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700" onClick={logout}>Logout</button>
        </div>

        <section className="border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-6 bg-white/80 dark:bg-neutral-900/80 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-4">WebSocket Settings</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">WebSocket Endpoint</label>
              <div className="sm:col-span-2">
                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    placeholder={envDefault}
                    value={s.wsUrl || ''}
                    onChange={(e) => setS({ ...s, wsUrl: e.target.value })}
                  />
                  <button
                    className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-sm"
                    onClick={() => setS({ ...s, wsUrl: '' })}
                    title="Use default from build env"
                  >
                    Use default
                  </button>
                </div>
                <div className="mt-1 text-gray-500 dark:text-gray-400 text-xs">
                  Leave empty to use default: {envDefault}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={onSave}>Save</button>
          <button className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-neutral-800" onClick={()=>{ setS(defaultSettings) }}>Reset (not saved)</button>
        </div>
      </div>
    </div>
  )
}

