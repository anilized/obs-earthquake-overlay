import React, { useEffect, useMemo, useRef, useState } from 'react'
import { connectEMSC, EmscProps, fromGenericExternal } from '../lib/emsc'
import { LAST_EVENT_KEY } from '../lib/emsc.shared'
import { chan, loadSettings, BOXES, WS_ENABLED_KEY } from '../lib/config'
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
  const [connToast, setConnToast] = useState<{ open: boolean; kind: 'info' | 'error'; text: string; status?: 'lost' | 'closed' }>({ open: false, kind: 'info', text: '' })
  const toastTimerRef = useRef<number | null>(null)
  const lastStatusRef = useRef<'open' | 'lost' | 'closed' | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const q = useQuery()
  const [pageActive, setPageActive] = useState<boolean>(() => {
    try { return document.visibilityState !== 'hidden' } catch { return true }
  })
  const [wsEnabled, setWsEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(WS_ENABLED_KEY)
      return v == null ? true : v !== 'false'
    } catch { return true }
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

  // settings sync + test + ws toggle
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as any
      if (data?.type === 'config:update') {
        setCfg(loadSettings()) // still use minMag, beep, soundUrl
      } else if (data?.type === 'ws:set') {
        const enabled = !!data.enabled
        setWsEnabled(enabled)
        try { localStorage.setItem(WS_ENABLED_KEY, String(enabled)) } catch {}
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
        if (p && passesFilters(p, cfg.minMag, TURKEY_BBOX)) {
          try {
            const cached = typeof localStorage !== 'undefined' ? (localStorage.getItem(LAST_EVENT_KEY) || '') : ''
            if (cached && cached === p.unid) return
            if (typeof localStorage !== 'undefined') localStorage.setItem(LAST_EVENT_KEY, p.unid)
            try { console.log(`#EQ-LAST ${p.unid}`) } catch {}
          } catch {}
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
    if (!pageActive || !wsEnabled) return
    const wsUrl = (cfg.wsUrl || '').trim() || undefined
    const stop = connectEMSC((p) => {
      const t = Date.parse(p.time || '') || 0
      if (t <= latestMs) return
      if (passesFilters(p, cfg.minMag, TURKEY_BBOX)) showNewAlert(p)
    }, wsUrl, (status) => {
      if (lastStatusRef.current === status) return
      lastStatusRef.current = status
      if (status === 'lost') {
        try { if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current) } catch {}
        setConnToast({ open: true, kind: 'error', text: 'WebSocket connection lost. Reconnecting…', status: 'lost' })
        toastTimerRef.current = window.setTimeout(() => setConnToast((t) => ({ ...t, open: false })), 4000) as unknown as number
      } else if (status === 'closed') {
        try { if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current) } catch {}
        setConnToast({ open: true, kind: 'info', text: 'WebSocket connection closed.', status: 'closed' })
        toastTimerRef.current = window.setTimeout(() => setConnToast((t) => ({ ...t, open: false })), 10000) as unknown as number
      } else if (status === 'open') {
        try { if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current) } catch {}
        setConnToast((t) => ({ ...t, open: false }))
      }
    })
    const onUnload = () => { try { stop && stop() } catch {} }
    try {
      window.addEventListener('beforeunload', onUnload)
      window.addEventListener('unload', onUnload)
    } catch {}
    return () => {
      try {
        window.removeEventListener('beforeunload', onUnload)
        window.removeEventListener('unload', onUnload)
      } catch {}
      stop && stop()
    }
  }, [cfg.minMag, cfg.wsUrl, pageActive, latestMs, wsEnabled])

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
  const overlayStyle = (cfg as any).overlayStyle === 'flat' ? 'flat' : 'cinematic'
  const isFlatLayout = overlayStyle === 'flat'
  const depthValue = alert ? `${alert.depth ?? '?'} km` : '-'
  const coordsValue = coords || '-'

  const flatGradient = {
    backgroundImage: `linear-gradient(115deg, rgba(${r}, ${g}, ${b}, 0.95), rgba(15, 23, 42, 0.88))`,
  } as React.CSSProperties

  // Connection popup uses a sky-blue themed flat card
  const connR = 14, connG = 165, connB = 233 // tailwind sky-500
  const connFlatGradient = {
    backgroundImage: `linear-gradient(115deg, rgba(${connR}, ${connG}, ${connB}, 0.95), rgba(15, 23, 42, 0.88))`,
  } as React.CSSProperties

  const cinematicGradient = {
    backgroundImage: `linear-gradient(360deg, rgba(${r}, ${g}, ${b}, 0.75), rgba(15, 23, 42, 0.92))`,
  } as React.CSSProperties

  const cinematicAlert = (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div
        className="absolute inset-0 -z-10 blur-2xl opacity-70"
        style={cinematicGradient}
      />
      <div
        className={[
          'pointer-events-auto relative w-full overflow-hidden rounded-[28px]',
          'border border-white/18 text-white shadow-[0_25px_55px_rgba(0,0,0,0.45)]',
          'opacity-0 translate-y-[-14px] animate-[slideIn_.32s_ease-out_forwards]',
          theme.ring,
        ].join(' ')}
        style={cinematicGradient}
      >
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: `radial-gradient(circle at top left, rgba(${r},${g},${b},0.45), transparent 55%), radial-gradient(circle at bottom right, rgba(15,23,42,0.85), transparent 55%)`,
          }}
          aria-hidden
        />
        <div className="relative px-6 py-6">
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/95 shadow-[0_0_20px_rgba(255,38,38,0.35)] animate-[alertPulse_2s_ease-in-out_infinite]">
              <span className="h-2 w-2 rounded-full bg-[#f87171] shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
              Earthquake
            </span>
          </div>
          <div className="mt-5 flex items-center gap-5">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span
                aria-hidden
                className="absolute h-full w-full rounded-[22px]"
                style={{
                  background: `radial-gradient(circle, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0) 70%)`,
                  animation: 'quakePulse 2.4s ease-in-out infinite',
                }}
              />
              <span
                className={`relative flex h-16 w-16 flex-col items-center justify-center rounded-[22px] ${theme.bg} text-[20px] font-black`}
                style={{ boxShadow: `0 20px 45px rgba(${r},${g},${b},0.35)` }}
              >
                <span>{m.toFixed(1)}</span>
                <span className="text-[9px] font-semibold tracking-[0.3em] text-white/80">mag</span>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[20px] font-semibold leading-tight">{title || 'Awaiting data'}</div>
              <div className="mt-1 truncate text-sm text-white/80">{subtitle || 'No live alert'}</div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 text-xs uppercase tracking-[0.22em] text-white/65 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3">
              <p className="text-[10px] font-semibold text-white/50">Depth</p>
              <p className="mt-1 text-sm font-semibold text-white">{depthValue}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3">
              <p className="text-[10px] font-semibold text-white/50">Coordinates</p>
              <p className="mt-1 text-sm font-semibold text-white">{coordsValue}</p>
            </div>
          </div>
        </div>
        <div className="relative h-[3px] w-full overflow-hidden bg-white/10">
          <div className="absolute inset-0 w-full animate-[sweep_3.2s_linear_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </div>
      </div>
    </div>
  )

  const flatAlert = (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div
        className={[
          'pointer-events-auto relative w-full overflow-hidden rounded-[22px]',
          'border border-white/15 bg-slate-950/80 text-white shadow-[0_18px_38px_rgba(0,0,0,0.45)]',
          'opacity-0 translate-y-[-10px] animate-[slideIn_.32s_ease-out_forwards]',
        ].join(' ')}
        style={flatGradient}
      >
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage: `radial-gradient(circle at top left, rgba(${r},${g},${b},0.4), transparent 55%), radial-gradient(circle at bottom right, rgba(15,23,42,0.85), transparent 55%)`,
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span
                aria-hidden
                className="absolute h-full w-full rounded-[20px]"
                style={{
                  background: `radial-gradient(circle, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0) 70%)`,
                  animation: 'quakePulse 2.4s ease-in-out infinite',
                }}
              />
              <span
                className={`relative flex h-14 w-14 flex-col items-center justify-center rounded-[20px] ${theme.bg} text-[18px] font-black`}
              >
                <span>{m.toFixed(1)}</span>
                <span className="text-[9px] font-semibold tracking-[0.3em] text-white/80">mag</span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[18px] font-semibold leading-tight">{title || 'Awaiting data'}</div>
              <div className="mt-1 truncate text-sm text-white/80">{subtitle || 'No live alert'}</div>
              <div className="mt-1 truncate text-xs text-white/70">{coordsValue}</div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 text-xs text-white/75 sm:items-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/90 animate-[alertPulse_2s_ease-in-out_infinite]">
              <span className="h-2 w-2 rounded-full bg-[#f87171] shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
              Earthquake
            </span>
            <span className="text-xs font-medium text-white/70">{timeStr || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  )

  const connectionAlert = (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div
        className={[
          'pointer-events-auto relative w-full overflow-hidden rounded-[22px]',
          'border border-white/15 bg-slate-950/80 text-white shadow-[0_18px_38px_rgba(0,0,0,0.45)]',
          'opacity-0 translate-y-[-10px] animate-[slideIn_.32s_ease-out_forwards]',
        ].join(' ')}
        style={connFlatGradient}
      >
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage: `radial-gradient(circle at top left, rgba(${connR},${connG},${connB},0.4), transparent 55%), radial-gradient(circle at bottom right, rgba(15,23,42,0.85), transparent 55%)`,
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span
                aria-hidden
                className="absolute h-full w-full rounded-[20px]"
                style={{
                  background: `radial-gradient(circle, rgba(${connR},${connG},${connB},0.55) 0%, rgba(${connR},${connG},${connB},0) 70%)`,
                  animation: 'quakePulse 2.4s ease-in-out infinite',
                }}
              />
              <span className={`relative flex h-14 w-14 items-center justify-center rounded-[20px] bg-sky-500 text-[14px] font-black`}>
                WS
              </span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[18px] font-semibold leading-tight">{connToast.status === 'lost' ? 'Connection Lost' : 'Connection Closed'}</div>
              <div className="mt-1 truncate text-sm text-white/85">{connToast.status === 'lost' ? 'Reconnecting…' : 'Stopped by user or server'}</div>
              <div className="mt-1 truncate text-xs text-white/70">WebSocket</div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 text-xs text-white/75 sm:items-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/90">
              <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.8)]" />
              Status
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-full w-full bg-transparent" style={{ pointerEvents: 'none' }}>
      {/* Connection status popup with flat overlay design */}
      {connToast.open && (
        <div className="fixed top-0 left-0" style={{ width: size, height: size }}>
          <div className="absolute inset-0 flex items-start justify-center pt-8">
            <div className="w-full" style={{ paddingLeft: padding, paddingRight: padding }}>
              {connectionAlert}
            </div>
          </div>
        </div>
      )}
      {/* Stage box: fixed region of size x size; popup is centered and fills horizontally */}
      <div className="fixed top-0 left-0" style={{ width: size, height: size }}>
        {alert && (
          <div className="absolute inset-0 flex items-center justify-center py-8">
            {/* container fills horizontally with padding; transparent outside the toast */}
            <div className="w-full" style={{ paddingLeft: padding, paddingRight: padding }}>
              {isFlatLayout ? flatAlert : cinematicAlert}
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







