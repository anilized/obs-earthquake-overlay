export type Country = 'Turkey' | 'Greece' | 'Italy' | 'Bulgaria' | 'Romania' | 'CustomBBox'
export type BBox = { latMin: number; latMax: number; lonMin: number; lonMax: number }

export const BOXES: Record<Exclude<Country, 'CustomBBox'>, BBox> = {
  Turkey:   { latMin: 35, latMax: 43, lonMin: 25, lonMax: 45 },
  Greece:   { latMin: 34, latMax: 42, lonMin: 19, lonMax: 29 },
  Italy:    { latMin: 36, latMax: 47, lonMin: 6,  lonMax: 19 },
  Bulgaria: { latMin: 41, latMax: 45, lonMin: 22, lonMax: 29 },
  Romania:  { latMin: 43, latMax: 49, lonMin: 20, lonMax: 30 },
};

export type Settings = {
  country: Country;
  bbox: BBox;
  minMag: number;
  beep: boolean;
  soundUrl: string; // relative (assets/default_alert.mp3) or https://...
  // Alert appearance/behavior
  notifColor: string; // CSS color for notification bar (e.g. #dc2626)
  displayDurationSec: number; // seconds on screen (0 => auto based on magnitude)
};

export const CONFIG_KEY = 'emscDockConfigV2';
export const chan = new BroadcastChannel('emsc-quake');

export const defaultSettings: Settings = {
  country: 'Turkey',
  bbox: BOXES.Turkey,
  minMag: 3.0,
  beep: true,
  soundUrl: 'assets/default_alert.mp3',
  notifColor: '#dc2626',
  displayDurationSec: 8,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultSettings;
    const s = JSON.parse(raw) as Partial<Settings> & { bbox?: Partial<BBox> };

    const country = (s.country ?? defaultSettings.country) as Country;
    const bbox: BBox =
      country === 'CustomBBox'
        ? {
            latMin: Number(s.bbox?.latMin ?? 35),
            latMax: Number(s.bbox?.latMax ?? 43),
            lonMin: Number(s.bbox?.lonMin ?? 25),
            lonMax: Number(s.bbox?.lonMax ?? 45),
          }
        : BOXES[country] ?? BOXES.Turkey;

    return {
      country,
      bbox,
      minMag: Number(s.minMag ?? defaultSettings.minMag),
      beep: typeof s.beep === 'boolean' ? s.beep : defaultSettings.beep,
      soundUrl: s.soundUrl ?? defaultSettings.soundUrl,
      notifColor: s.notifColor ?? (s as any).overlayBgColor ?? defaultSettings.notifColor,
      displayDurationSec: clampRange(Number(s.displayDurationSec ?? defaultSettings.displayDurationSec), 0, 120),
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
