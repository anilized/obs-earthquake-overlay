import React, { useEffect, useState } from 'react'
import { applyTheme, defaultSettings, fetchSettings, sanitizeSettings, updateSettings, type Settings } from '../lib/config'

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

  const [s, setS] = useState<Settings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { applyTheme(s.theme) }, [s.theme])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fetched = await fetchSettings()
        if (!cancelled) setS(sanitizeSettings(fetched))
      } catch (err) {
        console.error('Failed to fetch settings', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const persist = async (next: Settings) => {
    setSaving(true)
    setMessage(null)
    try {
      const updated = await updateSettings(sanitizeSettings(next))
      setS(updated)
      setMessage('Settings updated.')
    } catch (err) {
      console.error('Admin settings update failed', err)
      setMessage('Failed to update settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStream = () => {
    persist({ ...s, streamEnabled: !s.streamEnabled })
  }

  const handleMinMagChange = (value: string) => {
    const parsed = Number(value)
    setS((prev) => ({ ...prev, minMag: Number.isFinite(parsed) ? parsed : prev.minMag }))
  }

  const handleSave = () => persist(s)

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

  if (loading) {
    return (
      <div className="p-6 min-h-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 flex items-center justify-center">
        <span className="text-sm text-gray-600 dark:text-gray-300">Loading settings…</span>
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

        {message && <div className="mb-4 rounded-md bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">{message}</div>}

        <section className="border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-6 bg-white/80 dark:bg-neutral-900/80 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-3">Stream Control</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Toggle the global SSE stream for all connected overlays.
          </p>
          <button
            className={`px-4 py-2 rounded-md text-sm font-semibold text-white shadow transition ${s.streamEnabled ? 'bg-rose-600 shadow-rose-600/40 hover:bg-rose-500' : 'bg-emerald-600 shadow-emerald-600/40 hover:bg-emerald-500'}`}
            onClick={handleToggleStream}
            disabled={saving}
          >
            {s.streamEnabled ? 'Pause Stream' : 'Resume Stream'}
          </button>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Current status: {s.streamEnabled ? 'Active' : 'Paused'}
          </div>
        </section>

        <section className="border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-6 bg-white/80 dark:bg-neutral-900/80 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-3">Magnitude Filter</h3>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Minimum Magnitude</label>
            <input
              type="number"
              step="0.1"
              className="max-w-[160px] px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800"
              value={s.minMag}
              onChange={(e) => handleMinMagChange(e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">Events below this magnitude are filtered server-side.</p>
          </div>
        </section>

        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50" onClick={handleSave} disabled={saving}>
            Save
          </button>
          <button className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50" onClick={() => persist(defaultSettings)} disabled={saving}>
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  )
}

