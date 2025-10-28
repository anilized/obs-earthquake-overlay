import React, { useEffect, useMemo, useRef, useState } from 'react'
import { connectEMSC, EmscProps } from '../lib/emsc'
import { chan, loadSettings, BOXES } from '../lib/config'
import { reverseGeocodeCity } from '../lib/revgeo'
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

/** Badge/accents by magnitude (emergency red palette) */
function magColor(m: number) {
  if (m >= 7.5) return { bg: 'bg-[#b91c1c]', ring: 'ring-[#b91c1c]/50' }     // dark red
  if (m >= 6.5) return { bg: 'bg-[#dc2626]', ring: 'ring-[#dc2626]/40' }     // red
  if (m >= 5.5) return { bg: 'bg-[#f97316]', ring: 'ring-[#f97316]/40' }     // orange
  if (m >= 4.5) return { bg: 'bg-[#facc15]', ring: 'ring-[#facc15]/40' }     // yellow
  return              { bg: 'bg-[#22c55e]', ring: 'ring-[#22c55e]/40' }     // green
}


export default function Overlay() {
  const [cfg, setCfg] = useState(loadSettings)
  const [alert, setAlert] = useState<EmscProps | null>(null)
  const [cityLine, setCityLine] = useState<string>('')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const q = useQuery()

  // Stage sizing and scaling for high-DPI crispness in OBS
  // If size=auto (or omitted), fill the Browser Source viewport and scale UI accordingly.
  const sizeParam = q.get('size')
  const [vw, setVw] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 800)
  const [vh, setVh] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 600)
  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const autoStage = !sizeParam || sizeParam === 'auto'
  const stageWidth = autoStage ? vw : Math.max(400, Number(sizeParam))
  const stageHeight = autoStage ? vh : Math.max(400, Number(sizeParam))
  const basePad = Number(q.get('pad') ?? 16) // inner horizontal padding inside the stage (logical units)
  // Scale factor: explicit via ?scale=, otherwise in auto mode scale with viewport width relative to 800 base.
  const scale = useMemo(() => {
    const s = Number(q.get('scale'))
    if (!isNaN(s) && s > 0) return s
    if (autoStage && vw) return Math.max(0.5, vw / 800)
    return 1
  }, [q, autoStage, vw])
  const padding = Math.round(basePad * scale)

  // Always TURKEY bbox (ignore Settings country/bbox)
  const TURKEY_BBOX = BOXES.Turkey

  // settings sync + test
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as any
      if (data?.type === 'config:update') {
        setCfg(loadSettings()) // still use minMag, beep, soundUrl
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
          if (passesFilters(p, cfg.minMag, TURKEY_BBOX)) showNewAlert(p)
        } else {
          showNewAlert(p)
        }
      }
    }
    chan.addEventListener('message', handler)
    window.addEventListener('storage', () => setCfg(loadSettings()))
    return () => { chan.removeEventListener('message', handler as any) }
  }, [cfg.minMag])

  function passesFilters(p: EmscProps, minMag: number, bbox: typeof TURKEY_BBOX) {
    const mag = Number(p.mag || 0)
    const lat = Number(p.lat), lon = Number(p.lon)
    return (mag >= minMag && lat >= bbox.latMin && lat <= bbox.latMax && lon >= bbox.lonMin && lon <= bbox.lonMax)
  }

  // resolve sound: custom or default packaged asset
const soundSrc = useMemo(() => {
  const custom = (cfg.soundUrl || '').trim()
  if (custom) {
    // allow both .mp3 and .wav files
    const valid = custom.endsWith('.mp3') || custom.endsWith('.wav')
    if (valid) {
      try { return new URL(custom, document.location.href).href } catch { return custom }
    }
  }
  return asset('assets/default_alert.mp3')
}, [cfg.soundUrl])


  // EMSC live
  useEffect(() => {
    return connectEMSC((p) => {
      if (passesFilters(p, cfg.minMag, TURKEY_BBOX)) showNewAlert(p)
    })
  }, [cfg.minMag])

  /** Replace current alert with the new one, fetch city and restart audio */
  function showNewAlert(p: EmscProps) {
    setAlert(null)
    setCityLine('')
    setTimeout(async () => {
      setAlert(p)
      // reverse geocode city (cached)
      try {
        const g = await reverseGeocodeCity(Number(p.lat), Number(p.lon), 'tr') // TR labels by default
        const parts = [g.city || g.locality, g.admin].filter(Boolean)
        if (parts.length) setCityLine(parts.join(', '))
      } catch {}
    }, 0)
  }

  // audio: restart for each new alert
  useEffect(() => {
    if (!alert || !cfg.beep) return
    const a = audioRef.current
    if (!a) return
    try {
      a.pause()
      a.currentTime = 0
      a.src = soundSrc
      a.loop = true
      void a.play().catch(() => {})
    } catch {}
  }, [alert, cfg.beep, soundSrc])

  // auto dismiss
  useEffect(() => {
    if (!alert) return
    const m = Number(alert.mag ?? 0)
    const preferred = Number(cfg.displayDurationSec || 0) * 1000
    const keep = preferred > 0 ? preferred : (m >= 7 ? 12000 : m >= 6 ? 10000 : 8000)
    const t = setTimeout(() => setAlert(null), keep)
    const stop = setTimeout(() => {
      const a = audioRef.current
      if (a) { try { a.loop = false; a.pause() } catch {} }
    }, keep)
    return () => { clearTimeout(t); clearTimeout(stop) }
  }, [alert, cfg.displayDurationSec])

  // stop audio when alert disappears (manual/early)
  useEffect(() => {
    if (alert) return
    const a = audioRef.current
    if (a) { try { a.loop = false; a.pause() } catch {} }
  }, [alert])

  // UI bits
  const m = Number(alert?.mag ?? 0)
  const theme = magColor(m)
  // derive gradient from user-selected notification color
  function hexToRgb(hex: string) {
    const h = (hex || '').replace('#', '')
    if (h.length === 3) return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16) }
    if (h.length === 6) return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }
    return { r: 220, g: 38, b: 38 }
  }
  const { r, g, b } = hexToRgb(cfg.notifColor || '#dc2626')
  const gradFrom = `rgba(${r}, ${g}, ${b}, 0.35)`
  const gradTo = `rgba(${r}, ${g}, ${b}, 0.28)`
  const timeStr = alert?.time ? new Date(alert!.time).toLocaleString() : ''
  const subtitle = alert ? `M${m.toFixed(1)} Mw` : ''
  const title = alert ? `${cityLine || 'TURKEY'} • ${alert.depth ?? '?'} km` : ''
  const coords = alert ? `(${Number(alert.lat).toFixed(2)}, ${Number(alert.lon).toFixed(2)})` : ''

  return (
    <div className="h-full w-full bg-transparent" style={{ pointerEvents: 'none' }}>
      {/* Stage box: fixed region of size×size; popup is centered and fills horizontally */}
      <div className="fixed top-0 left-0" style={{ width: stageWidth, height: stageHeight }}>
        {alert && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* container fills horizontally with padding; transparent outside the toast */}
            <div className="w-full" style={{ paddingLeft: padding, paddingRight: padding }}>
              {/* Emergency bar: iPhone-like but fills width; no black bg */}
              <div
                className={[
                  'pointer-events-auto w-full text-white rounded-2xl',
                  'border border-white/25 backdrop-blur-xl shadow-xl',
                  'opacity-0 translate-y-[-8px] animate-[slideIn_.28s_ease-out_forwards]',
                  theme.ring
                ].join(' ')}
                style={{ backgroundImage: `linear-gradient(to bottom right, ${gradFrom}, ${gradTo})` }}
              >
                <div className="flex items-center" style={{ padding: `${Math.round(16 * scale)}px ${Math.round(20 * scale)}px`, gap: Math.round(16 * scale) }}>
                  {/* magnitude badge with color & number */}
                  <div className={`shrink-0 ${theme.bg} rounded-2xl flex items-center justify-center font-extrabold shadow-md`}
                       style={{ width: Math.round(48 * scale), height: Math.round(48 * scale), borderRadius: Math.round(16 * scale) }}>
                    <span style={{ fontSize: Math.round(20 * scale), lineHeight: 1 }}>{m.toFixed(1)}</span>
                  </div>

                  {/* text column */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate tracking-tight" style={{ fontSize: Math.round(16 * scale) }}>
                      {title}
                    </div>
                    <div className="text-white/95 truncate" style={{ fontSize: Math.round(13 * scale) }}>
                      {subtitle}
                    </div>
                    <div className="text-white/80 truncate" style={{ marginTop: Math.round(4 * scale), fontSize: Math.round(12 * scale) }}>
                      {timeStr} • {coords}
                    </div>
                  </div>
                </div>

                {/* subtle progress shimmer */}
                <div className="w-full bg-white/15 overflow-hidden rounded-b-2xl" style={{ height: Math.max(2, Math.round(3 * scale)) }}>
                  <div className="h-full w-1/2 bg-white/35 animate-[shimmer_2.4s_linear_infinite]" />
                </div>
              </div>

              {/* gentle glow behind the bar (not a full box, keeps transparency) */}
              <div className={`absolute inset-x-${padding} -z-10`} />
            </div>
          </div>
        )}
      </div>

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
        @keyframes slideIn {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
