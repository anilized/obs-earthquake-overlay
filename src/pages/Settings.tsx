import React, { useEffect, useState } from 'react'
import { defaultSettings, loadSettings, saveSettings, chan, applyTheme, type Theme } from '../lib/config'

type TestForm = {
  mag: number
  depth: number
  lat: number
  lon: number
  respectFilters: boolean
}

type ToastKind = 'success' | 'info' | 'error'

function useToast() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ToastKind>('info')
  const [text, setText] = useState('')

  function show(k: ToastKind, t: string, ms = 3000) {
    setKind(k)
    setText(t)
    setOpen(true)
    window.clearTimeout((show as any)._t)
    ;(show as any)._t = window.setTimeout(() => setOpen(false), ms)
  }

  return {
    open,
    kind,
    text,
    show,
    hide: () => setOpen(false),
  }
}

function Toast({
  open,
  kind,
  text,
  onClose,
}: {
  open: boolean
  kind: ToastKind
  text: string
  onClose: () => void
}) {
  const tone =
    kind === 'success'
      ? { accent: 'bg-emerald-500', border: 'border-emerald-400/40', ring: 'ring-emerald-400/40' }
      : kind === 'error'
      ? { accent: 'bg-rose-500', border: 'border-rose-400/40', ring: 'ring-rose-400/40' }
      : { accent: 'bg-sky-500', border: 'border-sky-400/40', ring: 'ring-sky-400/40' }

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-6 right-6 z-[2147483647]">
      <div
        className={`pointer-events-none transition-all duration-200 ${open ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
      >
        <div
          className={`pointer-events-auto flex max-w-[420px] items-start gap-3 rounded-2xl border bg-slate-950/90 px-4 py-3 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur ${tone.border} ${tone.ring}`}
          role="status"
        >
          <span className={`mt-[6px] inline-block h-3 w-3 rounded-full ${tone.accent}`} aria-hidden />
          <div className="flex-1 leading-relaxed">{text}</div>
          <button
            type="button"
            className="ml-2 rounded-full px-2 py-1 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Close notification"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function toneByMagnitude(mag: number) {
  if (mag >= 7.5) return { badge: 'bg-[#b91c1c]', ring: 'ring-[#b91c1c]/50' }
  if (mag >= 6.5) return { badge: 'bg-[#dc2626]', ring: 'ring-[#dc2626]/40' }
  if (mag >= 5.5) return { badge: 'bg-[#f97316]', ring: 'ring-[#f97316]/40' }
  if (mag >= 4.5) return { badge: 'bg-[#facc15]', ring: 'ring-[#facc15]/40' }
  return { badge: 'bg-[#22c55e]', ring: 'ring-[#22c55e]/40' }
}

function hexToRgb(hex: string) {
  const value = (hex || '').replace('#', '')
  if (value.length === 3) {
    return {
      r: parseInt(value[0] + value[0], 16),
      g: parseInt(value[1] + value[1], 16),
      b: parseInt(value[2] + value[2], 16),
    }
  }
  if (value.length === 6) {
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    }
  }
  return { r: 220, g: 38, b: 38 }
}

const themeOptions: Array<{ value: Theme; title: string; caption: string }> = [
  {
    value: 'dark',
    title: 'Dark Studio',
    caption: 'High contrast overlay with neon glow accents made for dim streaming rooms.',
  },
  {
    value: 'light',
    title: 'Daylight',
    caption: 'Clean, low-distraction visuals that shine on bright or newsroom layouts.',
  },
]

export default function Settings() {
  const [s, setS] = useState(() => loadSettings())
  const [test, setTest] = useState<TestForm>(() => {
    const stored = loadSettings()
    const baseMag = Math.max(3, Number(stored.minMag) + 0.5)
    return {
      mag: Number.isFinite(baseMag) ? Number(baseMag.toFixed(1)) : 3.5,
      depth: 10,
      lat: 39,
      lon: 35,
      respectFilters: true,
    }
  })
  const toast = useToast()

  useEffect(() => {
    try {
      applyTheme(s.theme)
    } catch {
      // no-op: theme application failed outside browser context
    }
  }, [s.theme])

  const updateSetting = <K extends keyof typeof s>(key: K, value: (typeof s)[K]) =>
    setS((prev) => ({ ...prev, [key]: value }))

  const handleSave = () => {
    const payload = {
      ...s,
      minMag: Number.isFinite(s.minMag) ? s.minMag : defaultSettings.minMag,
      displayDurationSec: Math.max(0, Number.isFinite(s.displayDurationSec) ? s.displayDurationSec : 0),
    }
    saveSettings(payload)
    toast.show('success', 'Settings saved. The overlay will refresh instantly.')
  }

  const handleResetDefaults = () => {
    const next = { ...defaultSettings }
    setS(next)
    saveSettings(next)
    toast.show('info', 'Defaults restored and saved.')
  }

  const handleSendTest = () => {
    chan.postMessage({
      type: 'test',
      payload: {
        ...test,
        mag: Number(test.mag),
        depth: Number(test.depth),
        lat: Number(test.lat),
        lon: Number(test.lon),
      },
    })
    toast.show('success', 'Test alert dispatched. Watch the overlay for the animation.')
  }

  const handleResetTest = () => {
    const baseMag = Math.max(3, Number(s.minMag) + 0.5)
    setTest({
      mag: Number.isFinite(baseMag) ? Number(baseMag.toFixed(1)) : 3.5,
      depth: 10,
      lat: 39,
      lon: 35,
      respectFilters: true,
    })
    toast.show('info', 'Test values restored.')
  }

  const updateTestNumber = <K extends keyof Omit<TestForm, 'respectFilters'>>(key: K, value: string) => {
    const parsed = Number(value)
    setTest((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? parsed : prev[key],
    }))
  }

  const isLightTheme = s.theme === 'light'
  const containerClass = isLightTheme
    ? 'min-h-full bg-slate-50 text-slate-900 transition-colors duration-300'
    : 'min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100 transition-colors duration-300'

  const cardBase = 'rounded-3xl backdrop-blur-xl'
  const cardTone = isLightTheme
    ? 'border border-white/80 bg-white/90 shadow-xl shadow-slate-200/50'
    : 'border border-white/10 bg-white/5 shadow-2xl shadow-black/50'
  const cardClass = `${cardBase} ${cardTone}`

  const inputBase = 'w-full rounded-2xl border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500/70'
  const inputTone = isLightTheme
    ? 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400'
    : 'border-white/10 bg-slate-900/60 text-slate-100 placeholder:text-slate-400 focus:border-sky-500/80'
  const inputClass = `${inputBase} ${inputTone}`

  const numberInputClass = `${inputClass} max-w-[140px]`
  const testInputClass = `${inputClass} max-w-full`

  const primaryButtonClass = isLightTheme
    ? 'inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/40 transition hover:bg-sky-500'
    : 'inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/40 transition hover:bg-sky-400'

  const ghostButtonClass = isLightTheme
    ? 'inline-flex items-center justify-center gap-2 rounded-full border border-slate-200/80 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900'
    : 'inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-white/40'

  const previewMag = Number.isFinite(test.mag) ? Number(test.mag) : 0
  const previewDepth = Number.isFinite(test.depth) ? `${test.depth} km depth` : 'Depth unknown'
  const previewLat = Number.isFinite(test.lat) ? Number(test.lat).toFixed(2) : '??'
  const previewLon = Number.isFinite(test.lon) ? Number(test.lon).toFixed(2) : '??'
  const previewSubtitle = `M${previewMag.toFixed(1)} Simulation`
  const previewTitle = `Preview Epicenter | ${previewDepth}`
  const previewCoords = `Lat ${previewLat} | Lon ${previewLon}`
  const previewTimestamp = new Date().toLocaleString()
  const previewTone = toneByMagnitude(previewMag)

  const { r: previewR, g: previewG, b: previewB } = hexToRgb(s.notifColor || '#dc2626')
  const previewGradient = {
    backgroundImage: `linear-gradient(135deg, rgba(${previewR}, ${previewG}, ${previewB}, 0.35), rgba(${previewR}, ${previewG}, ${previewB}, 0.28))`,
  } as React.CSSProperties
  const previewGlow = {
    position: 'absolute',
    inset: 0,
    transform: 'scale(1.08, 1.12)',
    filter: 'blur(42px)',
    opacity: 0.26,
    zIndex: -1,
    backgroundImage: `linear-gradient(135deg, rgba(${previewR}, ${previewG}, ${previewB}, 0.6), rgba(15, 23, 42, 0.35))`,
  } as React.CSSProperties

  return (
    <div className={containerClass}>
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-10">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Control Room
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Overlay Settings</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-300">
            Fine-tune the alert overlay before you go live. Shape the look, sound, and feel of earthquake alerts,
            and fire off quick tests without leaving your streaming software.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <section className={`${cardClass} p-6`}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
              Appearance
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              Dial in a visual style that matches your scene.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {themeOptions.map((option) => {
                const isActive = s.theme === option.value
                const optionTone = isLightTheme
                  ? 'border-slate-200/80 bg-white/90 hover:border-sky-300/70'
                  : 'border-white/10 bg-slate-950/30 hover:border-white/30'
                const optionActive = isActive
                  ? 'border-sky-400/80 bg-sky-500/10 shadow-lg shadow-sky-500/30 ring-2 ring-sky-400/50'
                  : ''
                return (
                  <label
                    key={option.value}
                    className={`relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition ${optionTone} ${optionActive}`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={option.value}
                      checked={isActive}
                      onChange={() => updateSetting('theme', option.value)}
                      className="sr-only"
                    />
                    {isActive && (
                      <span className="absolute right-4 top-4 rounded-full border border-sky-400/40 bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-100">
                        Active
                      </span>
                    )}
                    <span className="text-base font-semibold">{option.title}</span>
                    <span className="text-xs leading-relaxed text-slate-500 dark:text-slate-300">
                      {option.caption}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="mt-8">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                Notification Color
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <input
                  aria-label="Notification color"
                  type="color"
                  value={s.notifColor}
                  onChange={(e) => updateSetting('notifColor', e.target.value)}
                  className="h-12 w-14 cursor-pointer rounded-2xl border border-white/20 bg-transparent p-1 shadow-inner shadow-black/10"
                />
                <div className="min-w-[220px] flex-1">
                  <div className="overflow-hidden rounded-2xl border border-white/10 shadow-lg shadow-black/20" style={previewGradient}>
                    <div className="px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Live Alert</p>
                      <p className="mt-2 text-lg font-semibold text-white">Magnitude spike preview</p>
                      <p className="mt-1 text-xs text-white/80">
                        The gradient above mirrors the overlay bar in OBS.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                This color powers the glow on the alert bar. Pick something that matches your brand palette.
              </p>
            </div>
          </section>

          <aside className={`${cardClass} p-6`}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
              On-Stream Preview
            </h2>
            <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-inner shadow-black/30">
              <div className="flex items-center justify-between border-b border-white/5 pb-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                <span>Overlay Sample</span>
                <span className="text-[10px] font-normal tracking-normal text-white/40">Preview only</span>
              </div>
              <div className="mt-5 flex justify-center">
                <div className="relative w-full max-w-[420px]">
                  <div
                    className={[
                      'pointer-events-none w-full text-white rounded-[26px]',
                      'border border-white/15 backdrop-blur-2xl shadow-2xl',
                      previewTone.ring,
                    ].join(' ')}
                    style={previewGradient}
                  >
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${previewTone.badge} text-[18px] font-extrabold shadow-md`}
                      >
                        {previewMag.toFixed(1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold leading-tight tracking-tight">
                          {previewTitle}
                        </div>
                        <div className="truncate text-[13px] text-white/90">
                          {previewSubtitle}
                        </div>
                        <div className="mt-1 truncate text-[12px] text-white/80">
                          {previewTimestamp} | {previewCoords}
                        </div>
                      </div>
                    </div>
                    <div className="h-[3px] w-full overflow-hidden rounded-b-[26px] bg-white/15">
                      <div className="h-full w-1/2 animate-[shimmer_2.4s_linear_infinite] bg-white/35" />
                    </div>
                  </div>
                  <div aria-hidden className="pointer-events-none" style={previewGlow} />
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Update the test values below to instantly see how the overlay banner will feel on stream.
            </p>
          </aside>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className={`${cardClass} p-6`}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
              Alerts &amp; Audio
            </h2>
            <div className="mt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Minimum magnitude</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Only alerts at or above this level.</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={s.minMag}
                  onChange={(e) => updateSetting('minMag', Number(e.target.value))}
                  onBlur={(e) => {
                    const parsed = Number(e.target.value)
                    if (!Number.isFinite(parsed) || parsed < 0) {
                      updateSetting('minMag', defaultSettings.minMag)
                      toast.show('error', 'Enter a magnitude of 0 or higher (e.g., 3.5).')
                    }
                  }}
                  className={`mt-3 ${numberInputClass}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Notification duration</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Seconds on screen (0 = until cleared).</span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={s.displayDurationSec}
                  onChange={(e) => updateSetting('displayDurationSec', Number(e.target.value))}
                  onBlur={(e) => {
                    const parsed = Number(e.target.value)
                    if (!Number.isFinite(parsed) || parsed < 0) {
                      updateSetting('displayDurationSec', defaultSettings.displayDurationSec)
                      toast.show('error', 'Duration must be 0 or a positive number of seconds.')
                    }
                  }}
                  className={`mt-3 ${numberInputClass}`}
                />
              </div>

              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Beep on alert</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Play the audio cue whenever a quake triggers.
                  </p>
                </div>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={s.beep}
                    onChange={(e) => {
                      updateSetting('beep', e.target.checked)
                      toast.show('info', e.target.checked ? 'Audio cue enabled.' : 'Audio cue disabled.')
                    }}
                    className="peer sr-only"
                  />
                  <span className="h-6 w-11 rounded-full bg-slate-500/40 transition peer-checked:bg-sky-500/80" />
                  <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </div>
              </label>

              <div>
                <p className="text-sm font-semibold">Sound URL</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use a hosted .mp3 or .wav file if you want a custom alert sound.
                </p>
                <input
                  type="text"
                  placeholder="assets/default_alert.mp3 or https://your-domain.com/quake.wav"
                  value={s.soundUrl}
                  onChange={(e) => updateSetting('soundUrl', e.target.value)}
                  onBlur={(e) => {
                    if (!e.target.value.trim()) {
                      updateSetting('soundUrl', defaultSettings.soundUrl)
                      toast.show('info', 'Empty value detected. Reverted to the packaged alert sound.')
                    }
                  }}
                  className={`mt-3 ${inputClass}`}
                />
              </div>
            </div>
          </section>

          <section className={`${cardClass} p-6`}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
              Test tools
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              Simulate earthquake data to preview animations and audio inside OBS.
            </p>

            <div className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                    Magnitude
                  </p>
                  <input
                    type="number"
                    step="0.1"
                    value={test.mag}
                    onChange={(e) => updateTestNumber('mag', e.target.value)}
                    className={`mt-2 ${testInputClass}`}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                    Depth (km)
                  </p>
                  <input
                    type="number"
                    step="1"
                    value={test.depth}
                    onChange={(e) => updateTestNumber('depth', e.target.value)}
                    className={`mt-2 ${testInputClass}`}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                    Latitude
                  </p>
                  <input
                    type="number"
                    step="0.01"
                    value={test.lat}
                    onChange={(e) => updateTestNumber('lat', e.target.value)}
                    className={`mt-2 ${testInputClass}`}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                    Longitude
                  </p>
                  <input
                    type="number"
                    step="0.01"
                    value={test.lon}
                    onChange={(e) => updateTestNumber('lon', e.target.value)}
                    className={`mt-2 ${testInputClass}`}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-600 transition hover:border-white/30 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={test.respectFilters}
                  onChange={(e) => setTest((prev) => ({ ...prev, respectFilters: e.target.checked }))}
                  className="h-4 w-4 rounded border border-white/40 bg-transparent text-sky-500 focus:ring-sky-500/60"
                />
                <span>Respect filters (minimum magnitude)</span>
              </label>

              <div className="flex flex-wrap gap-3">
                <button type="button" className={primaryButtonClass} onClick={handleSendTest}>
                  Send test alert
                </button>
                <button type="button" className={ghostButtonClass} onClick={handleResetTest}>
                  Reset test values
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                The overlay listens on the BroadcastChannel and will render this synthetic alert instantly.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" className={primaryButtonClass} onClick={handleSave}>
            Save changes
          </button>
          <button type="button" className={ghostButtonClass} onClick={handleResetDefaults}>
            Reset to defaults
          </button>
        </div>

        <Toast open={toast.open} kind={toast.kind} text={toast.text} onClose={toast.hide} />
      </div>
    </div>
  )
}
