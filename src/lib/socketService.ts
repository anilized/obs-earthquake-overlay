import {
  LAST_EVENT_KEY,
  type CustomEventItem,
  type EmscProps,
  type GenericExternalMsg,
} from './emsc.shared';

export type { EmscProps, EmscMsg, GenericExternalMsg, CustomEventItem } from './emsc.shared';

function getLastEventId(): string {
  if (typeof localStorage === 'undefined') return '';
  try { return localStorage.getItem(LAST_EVENT_KEY) || ''; } catch { return ''; }
}

function setLastEventId(id: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    console.log(`#EQ-STORE-CACHE ${id}`);
    localStorage.setItem(LAST_EVENT_KEY, id);
  } catch {}
}

function normalizeTimestamp(ts: string | number | undefined | null): string | null {
  try {
    if (ts == null) return null;
    if (typeof ts === 'number') {
      const ms = ts < 1e12 ? ts * 1000 : ts;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof ts === 'string') {
      const n = Number(ts);
      if (!Number.isNaN(n)) return normalizeTimestamp(n);
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

function createWebSocket(url: string, bearer?: string): WebSocket {
  if (bearer) {
    try {
      return new WebSocket(url, ['bearer', bearer]);
    } catch {}
  }
  return new WebSocket(url);
}

async function parseMessage(ev: MessageEvent): Promise<any | null> {
  try {
    const d = ev.data;
    if (typeof d === 'string') return JSON.parse(d);
    if (d instanceof Blob) return JSON.parse(await d.text());
    if (d instanceof ArrayBuffer) return JSON.parse(new TextDecoder().decode(d));
  } catch {}
  return null;
}

function eventSignature(e: EmscProps): string {
  const t = normalizeTimestamp(e.time) || '';
  const m = Number.isFinite(e.mag) ? e.mag : -999;
  return `${e.unid}::${t}::${m}`;
}

export function fromGenericExternal(maybe: Partial<GenericExternalMsg>): EmscProps | null {
  const mag = Number((maybe as any)?.magnitude);
  const lat = Number((maybe as any)?.location?.latitude);
  const lon = Number((maybe as any)?.location?.longitude);
  const time = normalizeTimestamp((maybe as any)?.timestamp) || '';
  if (Number.isNaN(mag) || Number.isNaN(lat) || Number.isNaN(lon) || !time) return null;

  const depth = (maybe as any)?.depth;
  const unid = `${time}:${lat.toFixed(3)},${lon.toFixed(3)}`;
  return { unid, time, lat, lon, mag, depth: typeof depth === 'number' ? depth : undefined };
}

export function fromCustomEvent(item: Partial<CustomEventItem>): EmscProps | null {
  const id  = (item as any)?.id;
  const mag = Number((item as any)?.magnitude);
  const lat = Number((item as any)?.latitude);
  const lon = Number((item as any)?.longitude);
  const time = normalizeTimestamp((item as any)?.event_time) || '';
  if (!id || !time || Number.isNaN(mag) || Number.isNaN(lat) || Number.isNaN(lon)) return null;

  const depth    = (item as any)?.depth;
  const province = (item as any)?.province;
  const region   = (item as any)?.location;
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

export function connectEMSC(
  onEvent: (p: EmscProps) => void,
  urlOverride?: string,
  onStatus?: (s: 'open' | 'lost' | 'closed') => void,
) {
  const env: any = (typeof process !== 'undefined' && (process as any).env) ? (process as any).env : {};
  const baseUrl = String(urlOverride || env.NEXT_PUBLIC_EMSC_WS_URL || '').trim();
  if (!baseUrl) {
    console.warn('WebSocket URL is not configured');
    return () => {};
  }

  const bearer   = env.NEXT_PUBLIC_WS_BEARER || env.NEXT_PUBLIC_ALERT_BEARER || '';
  const topic    = env.NEXT_PUBLIC_ALERT_TOPIC || 'earthquake_alerts';
  const clientId = env.NEXT_PUBLIC_ALERT_CLIENT_ID || 'obs-overlay';
  const fixed    = env.NEXT_PUBLIC_ALERT_FIXED_TS;
  const winSec   = Number(env.NEXT_PUBLIC_ALERT_SINCE_WINDOW_SEC ?? 0);
  const pingSec  = Number(env.NEXT_PUBLIC_WS_PING_SEC ?? 25);

  let connectUrl = baseUrl;
  try { new URL(baseUrl); } catch {}

  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  const seen = new Set<string>();
  const lastIdCached = getLastEventId();
  if (lastIdCached) console.log(`#EQ last on cache ${lastIdCached}`);

  let attempt = 0;
  const nextDelay = () => {
    const base = Math.min(30_000, 2_000 * 2 ** attempt);
    const jitter = Math.floor(Math.random() * 500);
    return base + jitter;
  };

  const clearTimers = () => {
    if (timer) { clearTimeout(timer); timer = undefined; }
    if (heartbeat) { clearInterval(heartbeat); heartbeat = undefined; }
  };

  const subscribe = () => {
    try {
      const sinceTs =
        fixed != null && fixed !== ''
          ? Number(fixed)
          : (Number.isFinite(winSec) && winSec > 0
              ? Math.floor(Date.now() / 1000) - winSec
              : undefined);

      const msg: any = { type: 'subscribe', topic, id: clientId };
      if (sinceTs) msg.ts = sinceTs;

      const lastId = getLastEventId();
      if (lastId) msg.after_id = lastId;

      ws?.send(JSON.stringify(msg));
    } catch {}
  };

  async function handleMessage(ev: MessageEvent) {
    const msg = await parseMessage(ev);
    if (!msg) return;

    if (msg && msg.type === 'event' && msg.event === 'earthquake_alert' && (Array.isArray(msg.payload) || msg.payload)) {
      const items = Array.isArray(msg.payload) ? (msg.payload as any[]) : [msg.payload];
      const mapped = items.map(it => fromCustomEvent(it)).filter(Boolean) as EmscProps[];
      if (!mapped.length) return;

      const valid = mapped.filter(m => !!normalizeTimestamp(m.time));
      const latest = (valid.length ? valid : mapped).reduce((a, b) => {
        const ta = Date.parse(normalizeTimestamp(a.time) || '') || 0;
        const tb = Date.parse(normalizeTimestamp(b.time) || '') || 0;
        return tb > ta ? b : a;
      });

      try {
        const logObj: any = {
          id: latest.unid,
          time: normalizeTimestamp(latest.time),
          magnitude: latest.mag,
          latitude: latest.lat,
          longitude: latest.lon,
          depth: latest.depth,
          province: (latest as any).province,
          flynn_region: latest.flynn_region,
        };
        console.log(`#EQ-MSG: Earthquake message ${JSON.stringify(logObj)}`);
      } catch {}

      const sig = eventSignature(latest);
      if (seen.has(sig)) return;

      const cachedId = getLastEventId();
      if (cachedId && cachedId === latest.unid) {
        seen.add(sig);
        setLastEventId(latest.unid);
        try { console.log(`#EQ-LAST: Updated earthquake (same id, new rev): ${latest.unid}`); } catch {}
        onEvent(latest);
        return;
      }

      seen.add(sig);
      setLastEventId(latest.unid);
      try { console.log(`#EQ-LAST: Last earthquake cached: ${latest.unid}`); } catch {}
      onEvent(latest);
    }
  }

  function open() {
    if (stopped) return;

    try { ws?.close(); } catch {}
    ws = createWebSocket(connectUrl, bearer);

    ws.onopen = () => {
      try { onStatus?.('open') } catch {}
      attempt = 0;

      try {
        if (bearer) ws?.send(JSON.stringify({ type: 'auth', authorization: `Bearer ${bearer}` }));
      } catch {}

      subscribe();

      if (Number.isFinite(pingSec) && pingSec > 0) {
        try {
          if (heartbeat) clearInterval(heartbeat);
          heartbeat = setInterval(() => {
            try { ws?.send(JSON.stringify({ type: 'ping', t: Date.now() })); } catch {}
          }, pingSec * 1000);
        } catch {}
      }
    };

    ws.onmessage = (ev) => { void handleMessage(ev); };

    ws.onerror = () => {
      try { onStatus?.('lost') } catch {}
      try { ws?.close(); } catch {}
    };

    ws.onclose = () => {
      clearTimers();
      if (!stopped) {
        try { onStatus?.('lost') } catch {}
        const delay = nextDelay();
        attempt++;
        timer = setTimeout(open, delay);
      }
      else {
        try { onStatus?.('closed') } catch {}
      }
    };
  }

  open();

  return () => {
    stopped = true;
    clearTimers();
    try { ws?.close(); } catch {}
    ws = null;
    try { onStatus?.('closed') } catch {}
  };
}

