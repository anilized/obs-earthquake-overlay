import React, { useEffect, useMemo, useRef, useState } from 'react'
import { connectEMSC, EmscProps } from '../lib/emsc'
import { chan, loadSettings } from '../lib/config'
import { useLocation } from 'react-router-dom'

function useQuery() { return new URLSearchParams(useLocation().search) }

type TestMsg = {
  type: 'test'
  payload: {
    mag: number
    magtype: string
    depth: number
    lat: number
    lon: number
    flynn_region: string
    respectFilters: boolean
  }
}

/** Red gradient by magnitude (all variants are "emergency" themed) */
function redGradient(m: number) {
  if (m >= 7.5) return 'from-red-700 via-red-600 to-red-500'
  if (m >= 6.5) return 'from-red-600 via-red-500 to-rose-500'
  if (m >= 5.5) return 'from-rose-600 via-red-500 to-rose-400'
  return 'from-rose-500 via-red-500 to-rose-400'
}

export default function Overlay() {
  const [cfg, setCfg] = useState(loadSettings)
  const [alert, setAlert] = useState<EmscProps | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const q = useQuery()
  const size = Math.max(400, Number(q.get('size') ?? 800)) // default 800

  // keep cfg synced w/ settings + handle tests
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as any
      if (data?.type === 'config:update') {
        setCfg(loadSettings())
      } else if (data?.type === 'test') {
        const t = (data as TestMsg).payload
        const p: EmscProps = {
          unid: 'TEST-' + Date.now(),
          time: new Date().toISOString(),
          lat: Number(t.lat),
          lon: Number(t.lon),
          mag: Number(t.mag),
          magtype: t.magtype,
          depth: Number(t.depth),
          flynn_region: t.flynn_region || 'TEST'
        }
        if (t.respectFilters) {
          const b = cfg.bbox
          if (
            p.mag >= cfg.minMag &&
            p.lat >= b.latMin && p.lat <= b.latMax &&
            p.lon >= b.lonMin && p.lon <= b.lonMax
          ) showNewAlert(p)
        } else {
          showNewAlert(p)
        }
      }
    }
    chan.addEventListener('message', handler)
    window.addEventListener('storage', () => setCfg(loadSettings()))
    return () => { chan.removeEventListener('message', handler as any) }
  }, [cfg])

  // Resolve sound (relative or absolute)
  const soundSrc = useMemo(() => {
    const url = (cfg.soundUrl || 'assets/default_alert.mp3').trim()
    try { return new URL(url, document.location.href).href } catch { return url }
  }, [cfg.soundUrl])

  // Connect to EMSC
  useEffect(() => {
    return connectEMSC((p) => {
      const b = cfg.bbox
      const mag = Number(p.mag || 0)
      const lat = Number(p.lat), lon = Number(p.lon)
      if (mag >= cfg.minMag && lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax) {
        showNewAlert(p)
      }
    })
  }, [cfg])

  // Play (restart) audio for each alert
  useEffect(() => {
    if (!alert || !cfg.beep) return
    const a = audioRef.current
    if (!a) return
    try {
      // stop old sound and restart from 0
      a.pause()
      a.currentTime = 0
      // Reloading src ensures any quick back-to-back plays start clean
      a.src = soundSrc
      void a.play().catch(() => {})
    } catch { /* ignore */ }
  }, [alert, cfg.beep, soundSrc])

  /** Replace the current alert with a new one (remove old immediately) */
  function showNewAlert(p: EmscProps) {
    // remove old first so the new one appears "on top" cleanly
    setAlert(null)
    // slight microtask delay to let fade-out (if any) apply; visually instant in OBS
    setTimeout(() => setAlert(p), 0)
  }

  // UI data
  const mag = Number(alert?.mag ?? 0)
  const grad = redGradient(mag)
  const timeStr = alert?.time ? new Date(alert!.time).toLocaleString() : ''
  const title = alert ? `M${mag.toFixed(1)} ${alert.magtype ?? ''}`.trim() : ''
  const sub   = alert ? `${alert.flynn_region ?? 'Region'} • ${alert.depth ?? '?'} km` : ''
  const coords = alert ? `(${Number(alert.lat).toFixed(2)}, ${Number(alert.lon).toFixed(2)})` : ''
  const isStrong = mag >= 6

  // auto dismiss after N sec; since new alert replaces old, this timer is sufficient
  useEffect(() => {
    if (!alert) return
    const keep = mag >= 7 ? 17000 : mag >= 6 ? 14000 : 10000
    const t = setTimeout(() => setAlert(null), keep)
    return () => clearTimeout(t)
  }, [alert, mag])

  return (
    <div className="h-full w-full bg-transparent" style={{ pointerEvents: 'none' }}>
      {/* STAGE: fills the given size */}
      <div
        className="fixed top-0 left-0"
        style={{ width: size, height: size }}
      >
        {/* FILLING OVERLAY — emergency red theme */}
        <div className="relative h-full w-full text-white">
          {/* soft red gradient glow background (transparent edges to keep global transparency) */}
          <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-40 blur-2xl`} />
          {/* inner glass panel that fills all space */}
          <div className="absolute inset-0 p-6 flex flex-col">
            {/* headline banner */}
            <div
              className="flex items-center gap-3 w-full rounded-xl border border-red-400/50 bg-red-600/30 backdrop-blur-md shadow-glass px-4 py-3
                         translate-y-[-6px] opacity-0 animate-[fadein_.35s_ease-out_forwards]"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="h-8 w-8 rounded-full bg-red-500/90 flex items-center justify-center font-bold">!</div>
              <div className="text-lg font-semibold tracking-tight">
                EARTHQUAKE ALERT
              </div>
              {mag ? (
                <div className="ml-auto text-sm font-semibold px-2 py-1 rounded-md bg-red-500/80 border border-white/20">
                  M{mag.toFixed(1)}
                </div>
              ) : null}
            </div>

            {/* main card — fills remaining space */}
            <div className="relative mt-4 flex-1 rounded-2xl border border-white/10 bg-[#0b0b0b]/75 backdrop-blur-md shadow-glass overflow-hidden
                            translate-y-[-4px] opacity-0 animate-[fadein_.4s_ease-out_.08s_forwards]"
                 style={{ pointerEvents: 'auto' }}>
              {/* animated emergency frame */}
              <div className="absolute inset-0 rounded-2xl ring-2 ring-red-400/40" />
              {isStrong && (
                <>
                  <div className="absolute inset-4 rounded-2xl border-2 border-red-300/30 animate-pulse" />
                  <div className="absolute -inset-8 rounded-[32px] bg-red-500/20 blur-3xl animate-pulse" />
                </>
              )}

              {/* content fills */}
              <div className="relative h-full w-full grid grid-rows-[auto_auto_1fr_auto] gap-3 p-6">
                {/* title + region */}
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-red-600 shadow-lg flex items-center justify-center font-bold">
                    {mag ? mag.toFixed(1) : '—'}
                  </div>
                  <div className="flex-1">
                    <div className="text-[26px] font-semibold leading-tight">{title || 'Awaiting data…'}</div>
                    {alert && <div className="mt-1 text-sm text-white/90">{sub}</div>}
                  </div>
                </div>

                {/* meta */}
                <div className="text-xs text-white/75">
                  {alert ? `${timeStr} • ${coords}` : 'Listening…'}
                </div>

                {/* big center message */}
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    {alert ? (
                      <div className="text-red-100/95">
                        <div className="text-lg font-medium tracking-wide">Shaking reported by EMSC feed</div>
                        <div className="text-sm opacity-80 mt-1">Data may update as solutions refine</div>
                      </div>
                    ) : (
                      <div className="text-white/60">Waiting for events…</div>
                    )}
                  </div>
                </div>

                {/* progress shimmer bar */}
                <div className="h-[3px] w-full bg-white/15 overflow-hidden rounded">
                  <div className="h-full w-1/2 bg-white/35 animate-[shimmer_2.4s_linear_infinite]" />
                </div>
              </div>

              {/* manual dismiss (clickable in OBS if you enable interaction) */}
              {alert && (
                <div
                  className="absolute top-3 right-4 text-white/80 hover:text-white cursor-pointer select-none"
                  onClick={() => setAlert(null)}
                  title="Dismiss"
                  style={{ pointerEvents: 'auto' }}
                >
                  ✕
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* hidden audio; we force-stop and restart on each alert */}
      <audio ref={audioRef} src={soundSrc} preload="auto" />
      <style>{`
        @keyframes fadein { to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { transform: translateX(-100%);} 100% { transform: translateX(200%);} }
      `}</style>
    </div>
  )
}
