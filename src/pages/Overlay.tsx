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

/** Build an asset URL that respects Vite base on GitHub Pages */
function asset(url: string) {
  try { return new URL(url, import.meta.env.BASE_URL).href } catch { return url }
}

/** pick a small severity accent (all red family, but subtle) */
function accent(m: number) {
  if (m >= 7) return 'bg-red-600'
  if (m >= 6) return 'bg-red-500'
  if (m >= 5) return 'bg-rose-500'
  return 'bg-rose-400'
}

export default function Overlay() {
  const [cfg, setCfg] = useState(loadSettings)
  const [alert, setAlert] = useState<EmscProps | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const q = useQuery()
  // optional query params to position the toast within your scene
  const margin = Number(q.get('margin') ?? 16)           // px margin from edges
  const anchor = (q.get('anchor') ?? 'top-right') as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

  // settings sync + test messages
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

  // live feed
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

  // replace old -> show new; restart audio
  function showNewAlert(p: EmscProps) {
    setAlert(null)
    setTimeout(() => setAlert(p), 0)
  }

  useEffect(() => {
    if (!alert || !cfg.beep) return
    const a = audioRef.current
    if (!a) return
    try {
      a.pause()
      a.currentTime = 0
      a.src = soundSrc
      void a.play().catch(() => {})
    } catch {}
  }, [alert, cfg.beep, soundSrc])

  // auto dismiss
  useEffect(() => {
    if (!alert) return
    const m = Number(alert.mag ?? 0)
    const keep = m >= 7 ? 12000 : m >= 6 ? 10000 : 8000
    const t = setTimeout(() => setAlert(null), keep)
    return () => clearTimeout(t)
  }, [alert])

  // UI bits
  const m = Number(alert?.mag ?? 0)
  const chip = accent(m)
  const timeStr = alert?.time ? new Date(alert!.time).toLocaleString() : ''
  const title = alert ? `M${m.toFixed(1)} ${alert.magtype ?? ''}`.trim() : ''
  const subtitle = alert ? `${alert.flynn_region ?? 'Region'} • ${alert.depth ?? '?'} km` : ''
  const coords = alert ? `(${Number(alert.lat).toFixed(2)}, ${Number(alert.lon).toFixed(2)})` : ''

  // anchor classes
  const posClass =
    anchor === 'top-right' ? 'top-0 right-0' :
    anchor === 'top-left' ? 'top-0 left-0' :
    anchor === 'bottom-right' ? 'bottom-0 right-0' : 'bottom-0 left-0'

  const slideClass =
    anchor.startsWith('top') ? 'animate-slideDown' : 'animate-slideUp'

  return (
    <div className="h-full w-full bg-transparent" style={{ pointerEvents: 'none' }}>
      {/* nothing rendered when idle -> fully transparent */}
      {alert && (
        <div className={`fixed ${posClass}`} style={{ padding: margin }}>
          {/* iPhone-like toast card */}
          <div
            className={`pointer-events-auto max-w-[520px] w-[92vw] sm:w-[420px]
                        text-white rounded-2xl border border-white/20 bg-[rgba(18,18,18,0.68)] backdrop-blur-xl shadow-xl
                        opacity-0 translate-y-[-6px] ${slideClass}`}
          >
            <div className="px-4 py-3 flex gap-3 items-start">
              {/* severity chip */}
              <div className={`shrink-0 h-10 w-10 ${chip} rounded-xl flex items-center justify-center font-bold shadow-md`}>
                !
              </div>

              {/* text */}
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold truncate">
                  {title}
                </div>
                <div className="text-[13px] text-white/90 truncate">
                  {subtitle}
                </div>
                <div className="mt-1 text-[12px] text-white/70 truncate">
                  {timeStr} • {coords}
                </div>
              </div>

              {/* close */}
              <button
                className="ml-2 text-white/70 hover:text-white transition-colors"
                onClick={() => setAlert(null)}
                title="Dismiss"
              >
                ✕
              </button>
            </div>

            {/* progress bar */}
            <div className="h-[3px] w-full bg-white/10 overflow-hidden rounded-b-2xl">
              <div className="h-full w-1/2 bg-white/30 animate-shimmer" />
            </div>
          </div>
        </div>
      )}

      {/* audio (autoplay in OBS) */}
      <audio
        ref={audioRef}
        src={soundSrc}
        preload="auto"
        onError={() => {
          const a = audioRef.current
          if (a && !cfg.soundUrl) a.src = asset('assets/default_alert.mp3')
        }}
      />

      {/* tiny CSS for animations */}
      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%);} 100% { transform: translateX(200%);} }
        .animate-shimmer { animation: shimmer 2.4s linear infinite; }

        @keyframes slideDown {
          0% { opacity: 0; transform: translateY(-6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-slideDown { animation: slideDown .25s ease-out forwards; }
        .animate-slideUp { animation: slideUp .25s ease-out forwards; }
      `}</style>
    </div>
  )
}
