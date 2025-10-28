export type Country = 'Turkey'
export type BBox = { latMin: number; latMax: number; lonMin: number; lonMax: number }

export const BOXES: Record<Country, BBox> = {
  Turkey:   { latMin: 35, latMax: 43, lonMin: 25, lonMax: 45 },
};

export type Theme = 'light' | 'dark'

export type Settings = {
  minMag: number;
  beep: boolean;
  soundUrl: string; // relative (assets/default_alert.mp3) or https://...
  // Alert appearance/behavior
  notifColor: string; // CSS color for notification bar (e.g. #dc2626)
  displayDurationSec: number; // seconds on screen (0 => auto based on magnitude)
  theme: Theme;
};

export const CONFIG_KEY = 'emscDockConfigV2';
export const chan = new BroadcastChannel('emsc-quake');

export const defaultSettings: Settings = {
  minMag: 3.0,
  beep: true,
  soundUrl: 'assets/default_alert.mp3',
  notifColor: '#dc2626',
  displayDurationSec: 8,
  theme: 'light',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultSettings;
    const s = JSON.parse(raw) as any;

    return {
      minMag: Number(s.minMag ?? defaultSettings.minMag),
      beep: typeof s.beep === 'boolean' ? s.beep : defaultSettings.beep,
      soundUrl: s.soundUrl ?? defaultSettings.soundUrl,
      notifColor: s.notifColor ?? (s as any).overlayBgColor ?? defaultSettings.notifColor,
      displayDurationSec: clampRange(Number(s.displayDurationSec ?? defaultSettings.displayDurationSec), 0, 120),
      theme: (s.theme === 'dark' || s.theme === 'light') ? s.theme : defaultSettings.theme,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(s));
  chan.postMessage({ type: 'config:update' as const });
}

function clampRange(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (!root) return
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}
