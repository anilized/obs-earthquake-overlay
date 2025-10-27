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

  // --- TEST FORM ---
  // Use middle of current bbox as default lat/lon
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
        // ensure numbers
        mag: Number(test.mag),
        depth: Number(test.depth),
        lat: Number(test.lat),
        lon: Number(test.lon)
      }
    })
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
          <button className="px-3 py-2 rounded border" onClick={()=>{
            setTest({
              mag: Math.max(3, Number(s.minMag) + 0.5),
              magtype: 'Mw',
              depth: 10,
              lat: Number(midLat.toFixed(2)),
              lon: Number(midLon.toFixed(2)),
              flynn_region: s.country === 'CustomBBox' ? 'CUSTOM' : (s.country.toUpperCase() as string),
              respectFilters: true
            })
          }}>
            Reset Test Fields
          </button>
        </div>

        <div className="mt-2 text-gray-500 text-xs">
          The overlay listens on a BroadcastChannel and will show this synthetic alert. If “Respect filters” is on, the test must pass your Min Magnitude and fall within the selected BBox.
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
