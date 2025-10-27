import React, { useMemo, useState } from 'react'
import { BOXES, BBox, defaultSettings, loadSettings, saveSettings } from '../lib/config'

export default function Settings() {
  const [s, setS] = useState(loadSettings)

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
  }

  return (
    <div className="p-4 text-[13px] leading-5">
      <h2 className="text-xl font-semibold mb-3">EMSC Overlay — Settings</h2>

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
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="min-w-[120px] font-semibold">Beep on Alert</label>
          <input type="checkbox" checked={s.beep} onChange={(e) => update('beep', e.target.checked)} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-[120px] font-semibold">Sound URL</label>
          <input
            className="min-w-[360px] px-2 py-1 border rounded"
            placeholder="assets/default_alert.mp3 or https://…"
            value={s.soundUrl}
            onChange={(e) => update('soundUrl', e.target.value)}
          />
        </div>
        <div className="mt-1 text-gray-500 text-xs">
          Put your sound in <code>public/assets</code> and use a relative path like <code>assets/default_alert.mp3</code>.
        </div>
      </section>

      <div className="flex gap-3">
        <button className="px-3 py-2 rounded border bg-black text-white" onClick={onSave}>Save</button>
        <button className="px-3 py-2 rounded border" onClick={() => { setS(defaultSettings); saveSettings(defaultSettings); }}>
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
