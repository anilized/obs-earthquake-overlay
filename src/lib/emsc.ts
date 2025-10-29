export type EmscProps = {
  unid: string;
  time: string;
  lat: number;
  lon: number;
  mag: number;
  magtype?: string;
  depth?: number;
  flynn_region?: string;
  province?: string;
};

export type EmscMsg = {
  action?: 'create' | 'update' | string;
  data?: { properties?: Partial<EmscProps> };
};

function toProps(maybe: Partial<EmscProps>): EmscProps | null {
  const unid = String(maybe.unid ?? '');
  const time = String(maybe.time ?? '');
  const lat = Number(maybe.lat);
  const lon = Number(maybe.lon);
  const mag = Number(maybe.mag);
  if (!unid || !time || Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(mag)) return null;
  return {
    unid, time, lat, lon, mag,
    magtype: maybe.magtype, depth: maybe.depth, flynn_region: maybe.flynn_region, province: (maybe as any).province,
  };
}

export function connectEMSC(onEvent: (p: EmscProps) => void, urlOverride?: string) {
  const baseUrl = String(urlOverride || (import.meta as any).env?.VITE_EMSC_WS_URL || '');
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
  const seen = new Set<string>();

  function open() {
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
            if (!seen.has(latest.unid)) {
              seen.add(latest.unid);
              onEvent(latest);
            }
          }
          return;
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => { try { ws?.close(); } catch {} };
    ws.onclose = () => {
      if (heartbeat) { try { clearInterval(heartbeat) } catch {} ; heartbeat = undefined }
      timer = window.setTimeout(open, 2000);
    };
  }

  open();
  return () => { if (timer) clearTimeout(timer); if (heartbeat) clearInterval(heartbeat); try { ws?.close(); } catch {} };
}

// --- Generic external payload support ---

export type GenericExternalMsg = {
  magnitude: number;
  location: { latitude: number; longitude: number };
  depth?: number; // km
  timestamp: string | number; // ISO string or epoch ms/s
};

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
type CustomEventItem = {
  id: number | string;
  magnitude: number;
  location?: string;
  province?: string;
  latitude: number;
  longitude: number;
  depth?: number;
  event_time: string; // ISO time
};

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
