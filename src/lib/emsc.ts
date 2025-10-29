export type EmscProps = {
  unid: string;
  time: string;
  lat: number;
  lon: number;
  mag: number;
  magtype?: string;
  depth?: number;
  flynn_region?: string;
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
    magtype: maybe.magtype, depth: maybe.depth, flynn_region: maybe.flynn_region,
  };
}

export function connectEMSC(onEvent: (p: EmscProps) => void, urlOverride?: string) {
  const URL = String(urlOverride || (import.meta as any).env?.VITE_EMSC_WS_URL || 'wss://www.seismicportal.eu/standing_order/websocket');
  let ws: WebSocket | null = null;
  let timer: number | undefined;
  const seen = new Set<string>();

  function open() {
    try { ws?.close(); } catch {}
    ws = new WebSocket(URL);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as EmscMsg;
        const raw = msg?.data?.properties ?? {};
        const p = toProps(raw);
        if (!p || seen.has(p.unid)) return;
        seen.add(p.unid);
        onEvent(p);
      } catch { /* ignore */ }
    };
    ws.onclose = () => { timer = window.setTimeout(open, 2000); };
  }

  open();
  return () => { if (timer) clearTimeout(timer); try { ws?.close(); } catch {} };
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
