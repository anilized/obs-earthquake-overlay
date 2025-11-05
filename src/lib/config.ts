export type Theme = 'light' | 'dark'
export type OverlayStyle = 'square' | 'flat'

export type Settings = {
  minMag: number;
  beep: boolean;
  soundUrl: string;
  notifColor: string;
  displayDurationSec: number;
  theme: Theme;
  overlayStyle: OverlayStyle;
  streamEnabled: boolean;
};

export const defaultSettings: Settings = {
  minMag: 3.0,
  beep: true,
  soundUrl: 'assets/default_alert.mp3',
  notifColor: '#dc2626',
  displayDurationSec: 8,
  theme: 'dark',
  overlayStyle: 'square',
  streamEnabled: true,
};

export async function fetchSettings(): Promise<Settings> {
  try {
    const res = await fetch('/api/settings', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`settings fetch failed: ${res.status}`);
    const payload = await res.json();
    return sanitizeSettings(payload);
  } catch (err) {
    console.warn('Falling back to default settings after fetch error', err);
    return defaultSettings;
  }
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`settings update failed: ${res.status}`);
  const payload = await res.json();
  return sanitizeSettings(payload);
}

export async function resetSettings(): Promise<Settings> {
  const res = await fetch('/api/settings/reset', { method: 'POST', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`settings reset failed: ${res.status}`);
  const payload = await res.json();
  return sanitizeSettings(payload);
}

export type TestAlertPayload = {
  mag: number;
  depth: number;
  lat: number;
  lon: number;
  magtype?: string;
  province?: string;
  flynn_region?: string;
  respectFilters: boolean;
};

export async function sendTestAlert(payload: TestAlertPayload): Promise<void> {
  const res = await fetch('/api/events/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`test alert failed: ${res.status}`);
}

export function sanitizeSettings(raw: Partial<Settings>): Settings {
  const theme: Theme = raw.theme === 'light' ? 'light' : 'dark';
  const overlayStyle: OverlayStyle = raw.overlayStyle === 'flat' ? 'flat' : 'square';
  const minMag = Number.isFinite(raw.minMag) ? Math.max(0, Number(raw.minMag)) : defaultSettings.minMag;
  const displayDuration = Number.isFinite(raw.displayDurationSec)
    ? Math.max(0, Number(raw.displayDurationSec))
    : defaultSettings.displayDurationSec;
  const soundUrl = typeof raw.soundUrl === 'string' && raw.soundUrl.trim() !== ''
    ? raw.soundUrl.trim()
    : defaultSettings.soundUrl;
  const notifColor = typeof raw.notifColor === 'string' && raw.notifColor.trim() !== ''
    ? raw.notifColor.trim()
    : defaultSettings.notifColor;

  return {
    minMag,
    beep: typeof raw.beep === 'boolean' ? raw.beep : defaultSettings.beep,
    soundUrl,
    notifColor,
    displayDurationSec: displayDuration,
    theme,
    overlayStyle,
    streamEnabled: typeof raw.streamEnabled === 'boolean' ? raw.streamEnabled : defaultSettings.streamEnabled,
  };
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (!root) return
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}
