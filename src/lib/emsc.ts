import { LAST_EVENT_KEY, type CustomEventItem, type EmscProps, type GenericExternalMsg } from './emsc.shared';
export type { EmscProps, EmscMsg, GenericExternalMsg, CustomEventItem } from './emsc.shared';

function getLastEventId(): string {
  if (typeof localStorage === 'undefined') {
    console.warn('LocalStorage is not available; cannot persist last event ID');
    return '';
  }
  try { return localStorage.getItem(LAST_EVENT_KEY) || ''; } catch { return ''; }
}

function setLastEventId(id: string) {
  if (typeof localStorage === 'undefined') return;
  try { 
    console.log(`#EQ-STORE-CACHE ${id}`);
    localStorage.setItem(LAST_EVENT_KEY, id); 
  } catch { /* ignore */ }
}

export function connectEMSC(onEvent: (p: EmscProps) => void, urlOverride?: string) {
  const baseUrl = String(urlOverride || (import.meta as any).env?.VITE_EMSC_WS_URL || '').trim();
  if (!baseUrl) {
    // No endpoint configured; do not connect
    return () => {};
  }
  const bearer = (import.meta as any).env?.VITE_WS_BEARER || (import.meta as any).env?.VITE_ALERT_BEARER || '';
  // Append token as query param if present
  let connectUrl = baseUrl;
  try {
    if (bearer) {
      const u = new URL(baseUrl);
      if (!u.searchParams.get('token') && !u.searchParams.get('auth') && !u.searchParams.get('access_token')) {
        u.searchParams.set('auth', `Bearer ${bearer}`);
      }
      connectUrl = u.toString();
    }
  } catch { /* if URL ctor fails (relative), fall back to original */ }
  let ws: WebSocket | null = null;
  let timer: number | undefined;
  let heartbeat: number | undefined;
  let stopped = false; // prevent reconnects after explicit cleanup
  const seen = new Set<string>();
  try {
    const cached = getLastEventId();
    if (cached) console.log(`#EQ-LAST ${cached}`);
  } catch {}

  function open() {
    if (stopped) return; // don't open if we've been stopped
    try { ws?.close(); } catch {}
    ws = new WebSocket(connectUrl);
    ws.onopen = () => {
      // Send a subscribe message for the custom alerts backend
      try {
        if (bearer) {
          // Optional auth message for servers that expect an initial token frame
          try { ws?.send(JSON.stringify({ type: 'auth', authorization: `Bearer ${bearer}` })); } catch {}
        }
        const topic = (import.meta as any).env?.VITE_ALERT_TOPIC || 'earthquake_alerts';
        const clientId = (import.meta as any).env?.VITE_ALERT_CLIENT_ID || 'obs-overlay';
        const fixed = (import.meta as any).env?.VITE_ALERT_FIXED_TS;
        const winSec = Number((import.meta as any).env?.VITE_ALERT_SINCE_WINDOW_SEC || 0);
        const ts = fixed != null && fixed !== ''
          ? Number(fixed)
          : (Number.isFinite(winSec) && winSec > 0 ? Math.floor(Date.now() / 1000) - winSec : undefined);
        const msg: any = { type: 'subscribe', topic, id: clientId };
        if (ts) msg.ts = ts;
        ws?.send(JSON.stringify(msg));
      } catch { /* ignore */ }

      // Heartbeat keepalive (optional)
      try {
        const pingSec = Number((import.meta as any).env?.VITE_WS_PING_SEC || 25);
        if (Number.isFinite(pingSec) && pingSec > 0) {
          if (heartbeat) clearInterval(heartbeat);
          heartbeat = window.setInterval(() => {
            try { ws?.send(JSON.stringify({ type: 'ping', t: Date.now() })); } catch {}
          }, pingSec * 1000) as unknown as number;
        }
      } catch { /* ignore */ }
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        // Custom backend format only
        if (msg && msg.type === 'event' && msg.event === 'earthquake_alert' && (Array.isArray(msg.payload) || msg.payload)) {
          const items = Array.isArray(msg.payload) ? (msg.payload as any[]) : [msg.payload];
          const mapped = items
            .map(it => fromCustomEvent(it))
            .filter(Boolean) as EmscProps[];
          if (mapped.length) {
            // pick the latest by time
            const latest = mapped.reduce((a, b) => {
              const ta = Date.parse(a.time || '');
              const tb = Date.parse(b.time || '');
              return (tb > ta ? b : a);
            });
            // log only the latest one
            try {
              const logObj: any = {
                id: latest.unid,
                time: latest.time,
                magnitude: latest.mag,
                latitude: latest.lat,
                longitude: latest.lon,
                depth: latest.depth,
                province: (latest as any).province,
                flynn_region: latest.flynn_region,
              };
              console.log(`#EQ-MSG ${JSON.stringify(logObj)}`)
            } catch {}
            const cached = getLastEventId();
            if (cached === latest.unid) return;
            if (seen.has(latest.unid)) return;
            seen.add(latest.unid);
            setLastEventId(latest.unid);
            try { console.log(`#EQ-LAST ${latest.unid}`) } catch {}
            onEvent(latest);
          }
          return;
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => { try { ws?.close(); } catch {} };
    ws.onclose = () => {
      if (heartbeat) { try { clearInterval(heartbeat) } catch {} ; heartbeat = undefined }
      // Only attempt reconnect if not explicitly stopped
      if (!stopped) {
        timer = window.setTimeout(open, 2000);
      }
    };
  }

  open();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (heartbeat) clearInterval(heartbeat);
    try { ws?.close(); } catch {}
    ws = null;
  };
}

// --- Generic external payload support ---

function normalizeTimestamp(ts: string | number): string | null {
  try {
    if (typeof ts === 'string') {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) return d.toISOString();
      const n = Number(ts);
      if (!isNaN(n)) return normalizeTimestamp(n);
      return null;
    }
    if (typeof ts === 'number') {
      const ms = ts < 1e12 ? ts * 1000 : ts; // seconds -> ms if needed
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d.toISOString();
      return null;
    }
    return null;
  } catch { return null }
}

// Convert your provided shape to internal EmscProps
export function fromGenericExternal(maybe: Partial<GenericExternalMsg>): EmscProps | null {
  const mag = Number((maybe as any)?.magnitude);
  const lat = Number((maybe as any)?.location?.latitude);
  const lon = Number((maybe as any)?.location?.longitude);
  const time = normalizeTimestamp((maybe as any)?.timestamp as any) || '';
  if (Number.isNaN(mag) || Number.isNaN(lat) || Number.isNaN(lon) || !time) return null;

  const depth = (maybe as any)?.depth;
  const unid = `${time}:${lat.toFixed(3)},${lon.toFixed(3)}`;
  return { unid, time, lat, lon, mag, depth: typeof depth === 'number' ? depth : undefined };
}

// --- Custom backend event mapping ---

export function fromCustomEvent(item: Partial<CustomEventItem>): EmscProps | null {
  const id = (item as any)?.id;
  const mag = Number((item as any)?.magnitude);
  const lat = Number((item as any)?.latitude);
  const lon = Number((item as any)?.longitude);
  const time = (item as any)?.event_time ? new Date((item as any).event_time as string).toISOString() : '';
  if (!id || !time || Number.isNaN(mag) || Number.isNaN(lat) || Number.isNaN(lon)) return null;
  const depth = (item as any)?.depth;
  const province = (item as any)?.province;
  const region = (item as any)?.location;
  return {
    unid: String(id),
    time,
    lat,
    lon,
    mag,
    depth: typeof depth === 'number' ? depth : undefined,
    flynn_region: region ? String(region) : undefined,
    province: province ? String(province) : undefined,
  };
}
