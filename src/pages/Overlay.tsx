import React, { useEffect, useMemo, useRef, useState } from 'react'
import { connectEMSC, EmscProps, fromGenericExternal } from '../lib/emsc'
import { chan, loadSettings, BOXES } from '../lib/config'
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
  const [latestMs, setLatestMs] = useState<number>(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const q = useQuery()
  const [pageActive, setPageActive] = useState<boolean>(() => {
    try { return document.visibilityState !== 'hidden' } catch { return true }
  })
  useEffect(() => {
    const onVis = () => setPageActive(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Stage size box; popup is centered inside this and fills horizontally
  const size = Math.max(400, Number(q.get('size') ?? 800))
  const padding = Number(q.get('pad') ?? 16) // inner horizontal padding inside the stage

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
      } else if (data && typeof data === 'object') {
        // Accept direct external payload: { magnitude, location{latitude,longitude}, depth, timestamp }
        const p = fromGenericExternal(data)
        if (p && passesFilters(p, cfg.minMag, TURKEY_BBOX)) showNewAlert(p)
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
    if (!pageActive) return
    const wsUrl = (cfg.wsUrl || '').trim() || undefined
    return connectEMSC((p) => {
      const t = Date.parse(p.time || '') || 0
      if (t <= latestMs) return
      if (passesFilters(p, cfg.minMag, TURKEY_BBOX)) showNewAlert(p)
    }, wsUrl)
  }, [cfg.minMag, cfg.wsUrl, pageActive, latestMs])

  /** Replace current alert with the new one, fetch city and restart audio */
  function showNewAlert(p: EmscProps) {
    setAlert(null)
    setCityLine('')
    setTimeout(() => {
      setAlert(p)
      const t = Date.parse(p.time || '') || Date.now()
      setLatestMs(t)
      const prov = (p as any).province ? String((p as any).province) : ''
      const region = p.flynn_region ? String(p.flynn_region) : ''
      const parts = [prov, region].filter(Boolean)
      if (parts.length) setCityLine(parts.join(', '))
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
    return () => clearTimeout(t)
  }, [alert])

  // stop audio when alert disappears
  useEffect(() => {
    if (alert) return
    const a = audioRef.current
    if (!a) return
    try { a.loop = false; a.pause() } catch {}
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
  const gradFrom = `rgba(${r}, ${g}, ${b}, 0.65)`
  const gradTo = `rgba(15, 23, 42, 0.92)`
  const timeStr = alert?.time ? new Date(alert!.time).toLocaleString() : ''
  const subtitle = alert ? `M${m.toFixed(1)} ${alert.magtype ?? ''}`.trim() : ''
  const title = alert ? `${cityLine || (alert.flynn_region ?? 'Turkiye')}` : ''
  const coords = alert ? `Lat ${Number(alert.lat).toFixed(2)} | Lon ${Number(alert.lon).toFixed(2)}` : ''

  return (
    <div className="h-full w-full bg-transparent" style={{ pointerEvents: 'none' }}>
      {/* Stage box: fixed region of size x size; popup is centered and fills horizontally */}
      <div className="fixed top-0 left-0" style={{ width: size, height: size }}>
        {alert && (
          <div className="absolute inset-0 flex items-center justify-center py-8">
            {/* container fills horizontally with padding; transparent outside the toast */}
            <div className="w-full" style={{ paddingLeft: padding, paddingRight: padding }}>
              <div className="relative mx-auto w-full max-w-[460px]">
                <div
                  className="absolute inset-0 -z-10 blur-2xl opacity-70"
                  style={{
                    backgroundImage: `linear-gradient(120deg, rgba(${r},${g},${b},0.75), rgba(12,17,28,0.2))`,
                  }}
                />
                <div
                  className={[
                    'pointer-events-auto relative w-full overflow-hidden rounded-[28px]',
                    'border border-white/18 text-white shadow-[0_25px_55px_rgba(0,0,0,0.45)]',
                    'opacity-0 translate-y-[-14px] animate-[slideIn_.32s_ease-out_forwards]',
                    theme.ring,
                  ].join(' ')}
                  style={{ backgroundImage: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
                >
                  <div
                    className="absolute inset-0 opacity-70"
                    style={{
                      backgroundImage: `radial-gradient(circle at top left, rgba(${r},${g},${b},0.45), transparent 55%), radial-gradient(circle at bottom right, rgba(15,23,42,0.85), transparent 55%)`,
                    }}
                    aria-hidden
                  />
                  <div className="relative px-6 py-6">
                    <div className="flex items-center justify-between gap-4">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/95 shadow-[0_0_20px_rgba(255,38,38,0.35)] animate-[alertPulse_2s_ease-in-out_infinite]">
                        <span className="h-2 w-2 rounded-full bg-[#f87171] shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
                        EARTHQUAKE ALERT
                      </span>

                    </div>

                    <div className="mt-5 flex items-center gap-5">
                      <div
                        className="relative flex h-16 w-16 items-center justify-center"
                      >
                        <span
                          className="absolute h-full w-full rounded-[22px]"
                          style={{
                            background: `radial-gradient(circle, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0) 70%)`,
                            animation: 'quakePulse 2.4s ease-in-out infinite',
                          }}
                          aria-hidden
                        />
                        <span
                          className={`relative flex h-16 w-16 flex-col items-center justify-center rounded-[22px] ${theme.bg} text-[20px] font-black`}
                          style={{ boxShadow: `0 20px 45px rgba(${r},${g},${b},0.35)` }}
                        >
                          <span>{m.toFixed(1)}</span>
                          <span className="text-[9px] font-semibold tracking-[0.3em] text-white/80">
                            mag
                          </span>
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[20px] font-semibold leading-tight">
                          {title || 'Awaiting data'}
                        </div>
                        <div className="mt-1 truncate text-sm text-white/80">
                          {subtitle || 'No live alert'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 text-xs uppercase tracking-[0.22em] text-white/65 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3">
                        <p className="text-[10px] font-semibold text-white/50">Depth</p>
                        <p className="mt-1 text-sm font-semibold text-white">{alert ? `${alert.depth ?? '?'} km` : '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3">
                        <p className="text-[10px] font-semibold text-white/50">Coordinates</p>
                        <p className="mt-1 text-sm font-semibold text-white">{coords || '-'}</p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/75">
                      <span>{timeStr || '-'}</span>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-[6px] w-[6px] animate-[glimmer_2.6s_ease-in-out_infinite] rounded-full bg-white/70" />
                        {cfg.beep ? 'Audio cue armed' : 'Silent mode active'}
                      </span>
                    </div>
                  </div>

                  <div className="relative h-[3px] w-full overflow-hidden bg-white/10">
                    <div className="absolute inset-0 w-full animate-[sweep_3.2s_linear_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  </div>
                </div>
              </div>
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
        @keyframes slideIn {
          0% { opacity: 0; transform: translateY(-16px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes glimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes quakePulse {
          0% { transform: scale(1); opacity: 0.65; }
          50% { transform: scale(1.25); opacity: 0.2; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes alertPulse {
          0%, 100% { box-shadow: 0 0 18px rgba(248,113,113,0.35); transform: translateY(0); }
          50% { box-shadow: 0 0 32px rgba(248,113,113,0.6); transform: translateY(-1px); }
        }
      `}</style>
    </div>
  )
}





