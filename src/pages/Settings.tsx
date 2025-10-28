import React, { useEffect, useState } from 'react'
import { BOXES, defaultSettings, loadSettings, saveSettings, chan, applyTheme } from '../lib/config'

type TestForm = {
  mag: number
  depth: number
  lat: number
  lon: number
  flynn_region: string
  respectFilters: boolean
}

/* ------------ Toast (feedback) ------------ */

type ToastKind = 'success' | 'info' | 'error'

function useToast() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ToastKind>('info')
  const [text, setText] = useState<string>('')

  function show(k: ToastKind, t: string, ms = 2500) {
    setKind(k)
    setText(t)
    setOpen(true)
    window.clearTimeout((show as any)._t)
    ;(show as any)._t = window.setTimeout(() => setOpen(false), ms)
  }

  return {
    open, kind, text,
    show,
    hide: () => setOpen(false)
  }
}

function Toast({ open, kind, text, onClose }: { open: boolean; kind: ToastKind; text: string; onClose: () => void }) {
  const tone =
    kind === 'success'
      ? { dot: 'bg-emerald-500', ring: 'ring-emerald-400/40' }
      : kind === 'error'
      ? { dot: 'bg-rose-500', ring: 'ring-rose-400/40' }
      : { dot: 'bg-cyan-500', ring: 'ring-cyan-400/40' }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[2147483647]"
    >
      <div
        className={[
          'transition-all duration-200',
          open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none',
        ].join(' ')}
      >
        <div
          className={[
            'max-w-[520px] w-[min(92vw,420px)] text-white rounded-2xl border border-white/15',
            'bg-[rgba(18,18,18,0.75)] backdrop-blur-xl shadow-xl ring-2',
            tone.ring,
          ].join(' ')}
          role="status"
        >
          <div className="px-4 py-3 flex items-start gap-3">
            <div className={`h-3 w-3 rounded-full ${tone.dot} mt-[6px]`} />
            <div className="flex-1 text-[13px]">{text}</div>
            <button
              className="pointer-events-auto text-white/70 hover:text-white text-sm"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------ Settings Page ------------ */

export default function Settings() {
  const [s, setS] = useState(loadSettings)
  const toast = useToast()
  useEffect(() => { applyTheme(s.theme) }, [s.theme])

  // Fixed to Turkey
  const bboxTurkey = BOXES.Turkey

  const update = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS({ ...s, [k]: v })

  const onSave = () => {
    const payload = {
      ...s,
      minMag: Number(s.minMag) || 0,
    }
    saveSettings(payload)
    toast.show('success', 'Saved ✓ Settings updated.')
  }

  // --- TEST FORM (prefill center of bbox) ---
  const midLat = (bboxTurkey.latMin + bboxTurkey.latMax) / 2
  const midLon = (bboxTurkey.lonMin + bboxTurkey.lonMax) / 2

  const [test, setTest] = useState<TestForm>({
    mag: Math.max(3, Number(s.minMag) + 0.5),
    depth: 10,
    lat: Number(midLat.toFixed(2)),
    lon: Number(midLon.toFixed(2)),
    flynn_region: 'TURKEY',
    respectFilters: true
  })

  const sendTest = () => {
    chan.postMessage({
      type: 'test',
      payload: {
        ...test,
        mag: Number(test.mag),
        depth: Number(test.depth),
        lat: Number(test.lat),
        lon: Number(test.lon),
        magtype: 'Mw',
      }
    })
    toast.show('info', 'Test alert sent → Check the Overlay.')
  }

  const resetTests = () => {
    setTest({
      mag: Math.max(3, Number(s.minMag) + 0.5),
      depth: 10,
      lat: Number(midLat.toFixed(2)),
      lon: Number(midLon.toFixed(2)),
      flynn_region: 'TURKEY',
      respectFilters: true
    })
    toast.show('success', 'Test fields reset.')
  }

  const resetDefaults = () => {
    setS(defaultSettings)
    saveSettings(defaultSettings)
    toast.show('success', 'Settings reset to defaults.')
  }

  return (
    <div className="p-6 text-[13px] leading-5 text-gray-900 dark:text-gray-100 bg-white dark:bg-neutral-900 min-h-full">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold tracking-tight">Earthquake Overlay — Settings</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Tune how alerts look and behave during your stream.</p>
        </div>

      {/* SETTINGS */}
      <section className="border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-5 bg-white/80 dark:bg-neutral-900/80 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-4">Preferences</h3>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Theme</label>
            <div className="sm:col-span-2 flex items-center gap-4">
              <label className="inline-flex items-center gap-2">
                <input className="accent-indigo-600" type="radio" name="theme" checked={s.theme==='light'} onChange={()=>setS({ ...s, theme: 'light' as any })} />
                <span>Light</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input className="accent-indigo-600" type="radio" name="theme" checked={s.theme==='dark'} onChange={()=>setS({ ...s, theme: 'dark' as any })} />
                <span>Dark</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Min Magnitude</label>
            <div className="sm:col-span-2">
              <input
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                type="number" step="0.1"
                value={s.minMag}
                onChange={(e) => update('minMag', Number(e.target.value))}
                onBlur={(e) => isNaN(Number(e.target.value)) ? toast.show('error', 'Please enter a valid number.') : void 0}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Alert Sound</label>
            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2">
                <input className="accent-indigo-600" type="checkbox" checked={s.beep} onChange={(e) => { update('beep', e.target.checked); toast.show('info', e.target.checked ? 'Beep enabled.' : 'Beep disabled.') }} />
                <span>Enable sound on alert</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Sound URL</label>
            <div className="sm:col-span-2">
              <input
                className="w-full max-w-xl px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                placeholder="assets/default_alert.mp3 or https://…"
                value={s.soundUrl}
                onChange={(e) => update('soundUrl', e.target.value)}
                onBlur={() => { if (!s.soundUrl.trim()) toast.show('info', 'Using default: assets/default_alert.mp3') }}
              />
              <div className="mt-1 text-gray-500 dark:text-gray-400 text-xs">Use .mp3 or .wav. Remote URLs allowed.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Notification Duration</label>
            <div className="sm:col-span-2 flex items-center gap-3">
              <input
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                type="number" min={0} max={120} step={1}
                value={s.displayDurationSec}
                onChange={(e) => update('displayDurationSec', Number(e.target.value))}
                onBlur={(e) => {
                  const v = Number(e.target.value)
                  if (isNaN(v) || v < 0) toast.show('error', 'Enter 0 or a positive number of seconds.')
                  if (v === 0) toast.show('info', '0 = auto duration based on magnitude.')
                }}
              />
              <span className="text-gray-600 dark:text-gray-400 text-sm">seconds (0 = auto)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-center">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Notification Color</label>
            <div className="sm:col-span-2 flex items-center gap-3">
              <input
                aria-label="Notification Color"
                className="h-9 w-12 p-1 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800"
                type="color"
                value={s.notifColor}
                onChange={(e) => update('notifColor', e.target.value as any)}
              />
              <span className="text-gray-600 dark:text-gray-400 text-sm">applies to the alert bar gradient</span>
            </div>
          </div>
        </div>
      </section>

      {/* TEST */}
      <section className="border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-6 bg-white/80 dark:bg-neutral-900/80 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-4">Test Alert</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Magnitude</label>
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500" type="number" step="0.1" value={test.mag} onChange={e=>setTest(t=>({...t, mag:Number(e.target.value)}))} />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Depth</label>
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500" type="number" step="1" value={test.depth} onChange={e=>setTest(t=>({...t, depth:Number(e.target.value)}))} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Latitude</label>
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500" type="number" step="0.01" value={test.lat} onChange={e=>setTest(t=>({...t, lat:Number(e.target.value)}))} />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Longitude</label>
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500" type="number" step="0.01" value={test.lon} onChange={e=>setTest(t=>({...t, lon:Number(e.target.value)}))} />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Region</label>
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200" value={test.flynn_region} readOnly />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 mb-4">
          <input className="accent-indigo-600" type="checkbox" checked={test.respectFilters} onChange={e=>setTest(t=>({...t, respectFilters:e.target.checked}))}/>
          <span className="text-sm text-gray-800 dark:text-gray-200">Respect filters (Min Magnitude)</span>
        </label>

        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={sendTest}>
            Send Test
          </button>
          <button className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-neutral-800" onClick={resetTests}>
            Reset Test Fields
          </button>
        </div>

        <div className="mt-3 text-gray-500 dark:text-gray-400 text-xs">
          Overlay listens on a BroadcastChannel and shows this synthetic alert.
        </div>
      </section>

      <div className="flex gap-3">
        <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={onSave}>
          Save
        </button>
        <button className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-neutral-800" onClick={resetDefaults}>
          Reset to defaults
        </button>
      </div>

      {/* feedback toast */}
      <Toast open={toast.open} kind={toast.kind} text={toast.text} onClose={toast.hide} />
      </div>
    </div>
  )
}
