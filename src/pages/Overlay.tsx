import React, { useEffect, useMemo, useRef, useState } from 'react'
import { connectEMSC, EmscProps } from '../lib/emsc'
import { chan, loadSettings } from '../lib/config'
import { useLocation } from 'react-router-dom'

function useQuery() { return new URLSearchParams(useLocation().search) }

function gradForMag(m: number) {
  if (m >= 8) return 'from-fuchsia-500 to-indigo-500'
  if (m >= 7) return 'from-cyan-400 to-emerald-400'
  if (m >= 6) return 'from-amber-300 to-yellow-300'
  if (m >= 5) return 'from-yellow-400 to-yellow-200'
  if (m >= 4) return 'from-orange-400 to-amber-400'
  if (m >= 3) return 'from-rose-500 to-orange-400'
  return 'from-rose-400 to-rose-500'
}

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

export default function Overlay() {
  const [cfg, setCfg] = useState(loadSettings)
  const [alert, setAlert] = useState<EmscProps | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const q = useQuery()
  const size = Math.max(400, Number(q.get('size') ?? 800)) // default 800

  // keep cfg synced with settings & handle tests
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
          const lat = p.lat, lon = p.lon, mag = p.mag
          const b = cfg.bbox
          if (mag >= cfg.minMag && lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax) {
            setAlert(p)
          }
        } else {
          setAlert(p)
        }
      }
    }
    chan.addEventListener('message', handler)
    window.addEventListener('storage', () => setCfg(loadSettings()))
    return () => { chan.removeEventListener('message', handler as any) }
  }, [cfg])

  // sound (relative or absolute)
  const soundSrc = useMemo(() => {
    const url = (cfg.soundUrl || 'assets/default_alert.mp3').trim()
    try { return new URL(url, document.location.href).href } catch { return url }
  }, [cfg.soundUrl])

  // connect to EMSC
  useEffect(() => {
    return connectEMSC((p) => {
      const mag = Number(p.mag || 0)
      const b = cfg.bbox
      const lat = Number(p.lat), lon = Number(p.lon)
      if (mag >= cfg.minMag && lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax) {
        setAlert(p)
      }
    })
  }, [cfg])

  // play sound on alert
  useEffect(() => {
    if (alert && cfg.beep) audioRef.current?.play().catch(() => {})
  }, [alert, cfg.beep])

  // auto dismiss
  useEffect(() => {
    if (!alert) return
    const keep = (alert.mag ?? 0) >= 6 ? 16000 : (alert.mag ?? 0) >= 5 ? 12000 : 9000
    const t = setTimeout(() => setAlert(null), keep)
    return () => clearTimeout(t)
  }, [alert])

  const showRings = (alert?.mag ?? 0) >= 6
  const mag = Number(alert?.mag ?? 0)
  const timeStr = alert?.time ? new Date(alert!.time).toLocaleString() : ''
  const title = `M${mag.toFixed(1)} ${alert?.magtype || ''}`.trim()
  const sub = `${alert?.flynn_region || 'Region'} • ${alert?.depth ?? '?'} km`
  const coords = alert ? `(${Number(alert.lat).toFixed(2)}, ${Number(alert.lon).toFixed(2)})` : ''
  const grad = gradForMag(mag)

  return (
    <div className="h-full w-full bg-transparent" style={{ pointerEvents: 'none' }}>
      <div className="fixed top-0 left-0 flex items-center justify-center" style={{ width: size, height: size }}>
        {/* animated halo/rings */}
        {showRings && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`absolute w-[92%] h-[92%] rounded-full blur-2xl opacity-60 bg-gradient-to-br ${grad}`} />
            <div className="absolute w-[70%] h-[70%] rounded-full border border-white/20 animate-ping" />
            <div className="absolute w-[50%] h-[50%] rounded-full border border-white/20 animate-ping [animation-delay:300ms]" />
          </div>
        )}

        {/* alert card */}
        {alert && (
          <div
            className="relative max-w-[720px] w-[86%] text-white bg-card/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-glass p-6
                       translate-y-[-8px] scale-[.98] opacity-0 animate-[fadein_.35s_ease-out_forwards]"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex items-start gap-4">
              <div className={`shrink-0 h-14 w-14 rounded-full bg-gradient-to-br ${grad} shadow-lg`} />
              <div className="flex-1">
                <div className="text-[24px] font-semibold tracking-tight">{title}</div>
                <div className="mt-1 text-sm text-white/90">{sub}</div>
                <div className="mt-1 text-xs text-white/70">{timeStr} • {coords}</div>
              </div>
            </div>

            {/* progress shimmer */}
            <div className="mt-5 h-[3px] w-full bg-white/15 overflow-hidden rounded">
              <div className="h-full w-1/2 bg-white/35 animate-[shimmer_2.4s_linear_infinite]" />
            </div>

            {/* dismiss */}
            <div
              className="absolute top-2 right-3 text-white/70 hover:text-white cursor-pointer"
              onClick={() => setAlert(null)}
              style={{ pointerEvents: 'auto' }}
              title="Dismiss"
            >
              ✕
            </div>
          </div>
        )}
      </div>

      {/* hidden audio (autoplay in OBS) */}
      <audio ref={audioRef} src={soundSrc} preload="auto" />
      <style>{`
        @keyframes fadein { to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes shimmer { 0% { transform: translateX(-100%);} 100% { transform: translateX(200%);} }
      `}</style>
    </div>
  )
}
