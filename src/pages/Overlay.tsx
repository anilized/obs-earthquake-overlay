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

/** emergency red gradient */
function redGradient(m: number) {
  if (m >= 7.5) return 'from-red-700 via-red-600 to-red-500'
  if (m >= 6.5) return 'from-red-600 via-red-500 to-rose-500'
  if (m >= 5.5) return 'from-rose-600 via-red-500 to-rose-400'
  return 'from-rose-500 via-red-500 to-rose-400'
}

/** build an asset URL that respects Vite base on GitHub Pages */
function asset(url: string) {
  try {
    // import.meta.env.BASE_URL ends with a trailing slash
    return new URL(url, import.meta.env.BASE_URL).href
  } catch {
    return url
  }
}

export default function Overlay() {
  const [cfg, setCfg] = useState(loadSettings)
  const [alert, setAlert] = useState<EmscProps | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const q = useQuery()
  const size = Math.max(400, Number(q.get('size') ?? 800)) // only the popup bounds; background stays transparent

  // sync settings + handle test messages
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

  // resolve sound: settings value or default asset
  const soundSrc = useMemo(() => {
    const custom = (cfg.soundUrl || '').trim()
    if (custom) {
      try { return new URL(custom, document.location.href).href } catch { return custom }
    }
    return asset('assets/default_alert.mp3')
  }, [cfg.soundUrl])

  // EMSC
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

  // play (restart) audio per alert
  useEffect(() => {
    if (!alert || !cfg.beep) return
    const a = audioRef.current
    if (!a) return
    try {
      a.pause()
      a.currentTime = 0
      a.src = soundSrc // ensure fresh start, works on OBS + Pages
      void a.play().catch(() => {})
    } catch { /* ignore */ }
  }, [alert, cfg.beep, soundSrc])

  // replace old alert immediately
  function showNewAlert(p: EmscProps) {
    setAlert(null)
    setTimeout(() => setAlert(p), 0)
  }

  // auto dismiss
  useEffect(() => {
    if (!alert) return
    const mag = Number(alert.mag ?? 0)
    const keep = mag >= 7 ? 15000 : mag >= 6 ? 12000 : 9000
    const t = setTimeout(() => setAlert(null), keep)
    return () => clearTimeout(t)
  }, [alert])

  // UI data
  const mag = Number(alert?.mag ?? 0)
  const grad = redGradient(mag)
  const timeStr = alert?.time ? new Date(alert!.time).toLocaleString() : ''
  const title = alert ? `M${mag.toFixed(1)} ${alert.magtype ?? ''}`.trim() : ''
  const sub   = alert ? `${alert.flynn_region ?? 'Region'} • ${alert.depth ?? '?'} km` : ''
  const coords = alert ? `(${Number(alert.lat).toFixed(2)}, ${Number(alert.lon).toFixed(2)})` : ''
  const strong = mag >= 6

  return (
    <div className="h-full w-full bg-transparent" style={{ pointerEvents: 'none' }}>
      {/* popup canvas (transparent outside) */}
      <div className="fixed top-0 left-0 flex items-center justify-center" style={{ width: size, height: size }}>
        {/* show nothing when idle to keep overlay fully transparent */}
        {alert && (
          <div
            className="relative w-full h-full text-white"
            style={{ pointerEvents: 'auto' }}
          >
            {/* popup fills the given size, with transparent edges via opacity */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              {/* subtle red glow background, still transparent overall */}
              <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-25 blur-2xl`} />

              {/* emergency card (centered, fills most of the canvas) */}
              <div className="absolute inset-0 p-5 flex flex-col">
                {/* top banner */}
                <div className="flex items-center gap-3 rounded-xl border border-red-400/50 bg-red-600/30 backdrop-blur-md shadow-glass px-4 py-3
                                translate-y-[-6px] opacity-0 animate-[fadein_.25s_ease-out_forwards]">
                  <div className="h-8 w-8 rounded-full bg-red-500/90 flex items-center justify-center font-bold">!</div>
                  <div className="text-lg font-semibold tracking-tight">EARTHQUAKE ALERT</div>
                  <div className="ml-auto text-sm font-semibold px-2 py-1 rounded-md bg-red-500/80 border border-white/20">
                    M{mag.toFixed(1)}
                  </div>
                </div>

                {/* main panel fills */}
                <div className="relative mt-4 flex-1 rounded-2xl border border-white/10 bg-[#0b0b0b]/80 backdrop-blur-md shadow-glass overflow-hidden
                                translate-y-[-4px] opacity-0 animate-[fadein_.35s_ease-out_.06s_forwards]">
                  {/* animated frame for stronger events */}
                  <div className="absolute inset-0 rounded-2xl ring-2 ring-red-400/40" />
                  {strong && (
                    <>
                      <div className="absolute inset-4 rounded-2xl border-2 border-red-300/30 animate-pulse" />
                      <div className="absolute -inset-8 rounded-[32px] bg-red-500/20 blur-3xl animate-pulse" />
                    </>
                  )}

                  {/* content */}
                  <div className="relative h-full w-full grid grid-rows-[auto_auto_1fr_auto] gap-3 p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-red-600 shadow-lg flex items-center justify-center font-bold">
                        {mag.toFixed(1)}
                      </div>
                      <div className="flex-1">
                        <div className="text-[26px] font-semibold leading-tight">{title}</div>
                        <div className="mt-1 text-sm text-white/90">{sub}</div>
                      </div>
                    </div>

                    <div className="text-xs text-white/75">
                      {timeStr} • {coords}
                    </div>

                    <div className="flex items-center justify-center">
                      <div className="text-center text-red-100/95">
                        <div className="text-lg font-medium tracking-wide">Emergency notification</div>
                        <div className="text-sm opacity-80 mt-1">Data may update as solutions refine</div>
                      </div>
                    </div>

                    {/* progress shimmer */}
                    <div className="h-[3px] w-full bg-white/15 overflow-hidden rounded">
                      <div className="h-full w-1/2 bg-white/35 animate-[shimmer_2.4s_linear_infinite]" />
                    </div>
                  </div>

                  {/* dismiss (clickable if OBS interaction is enabled) */}
                  <div
                    className="absolute top-3 right-4 text-white/80 hover:text-white cursor-pointer select-none"
                    onClick={() => setAlert(null)}
                    title="Dismiss"
                  >
                    ✕
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* hidden audio */}
      <audio
        ref={audioRef}
        src={soundSrc}
        preload="auto"
        onError={() => {
          // Fallback: if custom URL fails, attempt default asset
          const a = audioRef.current
          if (a && !cfg.soundUrl) a.src = asset('assets/default_alert.mp3')
        }}
      />

      <style>{`
        @keyframes fadein { to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { transform: translateX(-100%);} 100% { transform: translateX(200%);} }
      `}</style>
    </div>
  )
}
