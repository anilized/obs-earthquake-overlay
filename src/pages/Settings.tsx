import React, { useMemo, useState } from 'react'
import { BOXES, BBox, defaultSettings, loadSettings, saveSettings, chan } from '../lib/config'

type TestForm = {
  mag: number
  magtype: string
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

  // Lock default bbox preview to the chosen country (or custom values)
  const bboxFromCountry = useMemo(() => {
    return s.country === 'CustomBBox' ? s.bbox : BOXES[s.country] || BOXES.Turkey
  }, [s.country, s.bbox])

  const update = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS({ ...s, [k]: v })
  const setBBox = (p: Partial<BBox>) => update('bbox', { ...s.bbox, ...p })

  const onSave = () => {
    const payload = {
      ...s,
      minMag: Number(s.minMag) || 0,
      bbox: s.country === 'CustomBBox' ? s.bbox : (BOXES[s.country] || BOXES.Turkey),
    }
    saveSettings(payload)
    toast.show('success', 'Saved ✓ Settings updated.')
  }

  // --- TEST FORM (prefill center of bbox) ---
  const midLat = (bboxFromCountry.latMin + bboxFromCountry.latMax) / 2
  const midLon = (bboxFromCountry.lonMin + bboxFromCountry.lonMax) / 2

  const [test, setTest] = useState<TestForm>({
    mag: Math.max(3, Number(s.minMag) + 0.5),
    magtype: 'Mw',
    depth: 10,
    lat: Number(midLat.toFixed(2)),
    lon: Number(midLon.toFixed(2)),
    flynn_region: s.country === 'CustomBBox' ? 'CUSTOM' : (s.country.toUpperCase() as string),
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
      }
    })
    toast.show('info', 'Test alert sent → Check the Overlay.')
  }

  const resetTests = () => {
    setTest({
      mag: Math.max(3, Number(s.minMag) + 0.5),
      magtype: 'Mw',
      depth: 10,
      lat: Number(midLat.toFixed(2)),
      lon: Number(midLon.toFixed(2)),
      flynn_region: s.country === 'CustomBBox' ? 'CUSTOM' : (s.country.toUpperCase() as string),
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
    <div className="p-4 text-[13px] leading-5">
      <h2 className="text-xl font-semibold mb-3">EMSC Overlay — Settings</h2>

      {/* SETTINGS */}
      <section className="border border-gray-300 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="min-w-[120px] font-semibold">Country</label>
          <select
            className="px-2 py-1 border rounded"
            value={s.country}
            onChange={(e) => update('country', e.target.value as any)}
          >
            {Object.keys(BOXES).map(c => <option key={c}>{c}</option>)}
            <option>CustomBBox</option>
          </select>
        </div>

        {s.country === 'CustomBBox' ? (
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <label className="min-w-[120px] font-semibold">Custom BBox</label>
            <div>latMin <input className="w-24 px-2 py-1 border rounded" type="number" step="0.1" value={s.bbox.latMin} onChange={(e)=>setBBox({latMin:Number(e.target.value)})} /></div>
            <div>latMax <input className="w-24 px-2 py-1 border rounded" type="number" step="0.1" value={s.bbox.latMax} onChange={(e)=>setBBox({latMax:Number(e.target.value)})} /></div>
            <div>lonMin <input className="w-24 px-2 py-1 border rounded" type="number" step="0.1" value={s.bbox.lonMin} onChange={(e)=>setBBox({lonMin:Number(e.target.value)})} /></div>
            <div>lonMax <input className="w-24 px-2 py-1 border rounded" type="number" step="0.1" value={s.bbox.lonMax} onChange={(e)=>setBBox({lonMax:Number(e.target.value)})} /></div>
          </div>
        ) : (
          <div className="text-gray-600 mb-1">
            BBox: {bboxFromCountry.latMin}–{bboxFromCountry.latMax} / {bboxFromCountry.lonMin}–{bboxFromCountry.lonMax}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="min-w-[120px] font-semibold">Min Magnitude</label>
          <input
            className="w-28 px-2 py-1 border rounded"
            type="number" step="0.1"
            value={s.minMag}
            onChange={(e) => update('minMag', Number(e.target.value))}
            onBlur={(e) => isNaN(Number(e.target.value)) ? toast.show('error', 'Please enter a valid number.') : void 0}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="min-w-[120px] font-semibold">Beep on Alert</label>
          <input
            type="checkbox"
            checked={s.beep}
            onChange={(e) => { update('beep', e.target.checked); toast.show('info', e.target.checked ? 'Beep enabled.' : 'Beep disabled.') }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-[120px] font-semibold">Sound URL</label>
          <input
            className="min-w-[360px] px-2 py-1 border rounded"
            placeholder="assets/default_alert.mp3 or https://…"
            value={s.soundUrl}
            onChange={(e) => update('soundUrl', e.target.value)}
            onBlur={() => {
              if (!s.soundUrl.trim()) toast.show('info', 'Using default: assets/default_alert.mp3')
            }}
          />
        </div>
        <div className="mt-1 text-gray-500 text-xs">
          You can put .mp3 or .wav link as an alternative (https://testdomain.com/test_alert.wav).
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-[120px] font-semibold">Notification Duration</label>
          <input
            className="w-28 px-2 py-1 border rounded"
            type="number" min={0} max={120} step={1}
            value={s.displayDurationSec}
            onChange={(e) => update('displayDurationSec', Number(e.target.value))}
            onBlur={(e) => {
              const v = Number(e.target.value)
              if (isNaN(v) || v < 0) toast.show('error', 'Enter 0 or a positive number of seconds.')
              if (v === 0) toast.show('info', '0 = auto duration based on magnitude.')
            }}
          />
          <span className="text-gray-600 text-sm">seconds (0 = auto)</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="min-w-[120px] font-semibold">Notification Color</label>
          <input
            aria-label="Notification Color"
            className="h-8 w-12 p-0 border rounded"
            type="color"
            value={s.notifColor}
            onChange={(e) => update('notifColor', e.target.value as any)}
          />
          <span className="text-gray-600 text-sm">Used for the alert bar gradient.</span>
        </div>
      </section>

      {/* TEST */}
      <section className="border border-gray-300 rounded-xl p-4 mb-4">
        <h3 className="font-semibold mb-2">Test Alert</h3>

        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div>Magnitude <input className="w-24 px-2 py-1 border rounded" type="number" step="0.1" value={test.mag} onChange={e=>setTest(t=>({...t, mag:Number(e.target.value)}))} /></div>
          <div>Type <input className="w-20 px-2 py-1 border rounded" value={test.magtype} onChange={e=>setTest(t=>({...t, magtype:e.target.value}))} /></div>
          <div>Depth <input className="w-20 px-2 py-1 border rounded" type="number" step="1" value={test.depth} onChange={e=>setTest(t=>({...t, depth:Number(e.target.value)}))} /></div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div>Lat <input className="w-24 px-2 py-1 border rounded" type="number" step="0.01" value={test.lat} onChange={e=>setTest(t=>({...t, lat:Number(e.target.value)}))} /></div>
          <div>Lon <input className="w-24 px-2 py-1 border rounded" type="number" step="0.01" value={test.lon} onChange={e=>setTest(t=>({...t, lon:Number(e.target.value)}))} /></div>
          <div>Region <input className="w-44 px-2 py-1 border rounded" value={test.flynn_region} onChange={e=>setTest(t=>({...t, flynn_region:e.target.value}))} /></div>
        </div>

        <label className="inline-flex items-center gap-2 mb-3">
          <input type="checkbox" checked={test.respectFilters} onChange={e=>setTest(t=>({...t, respectFilters:e.target.checked}))}/>
          <span>Respect filters (Min M & BBox)</span>
        </label>

        <div className="flex gap-3">
          <button className="px-3 py-2 rounded border bg-black text-white" onClick={sendTest}>
            Send Test
          </button>
          <button className="px-3 py-2 rounded border" onClick={resetTests}>
            Reset Test Fields
          </button>
        </div>

        <div className="mt-2 text-gray-500 text-xs">
          The overlay listens on a BroadcastChannel and will show this synthetic alert.
        </div>
      </section>

      <div className="flex gap-3">
        <button className="px-3 py-2 rounded border bg-black text-white" onClick={onSave}>
          Save
        </button>
        <button className="px-3 py-2 rounded border" onClick={resetDefaults}>
          Reset to defaults
        </button>
      </div>

      {/* feedback toast */}
      <Toast open={toast.open} kind={toast.kind} text={toast.text} onClose={toast.hide} />
    </div>
  )
}
