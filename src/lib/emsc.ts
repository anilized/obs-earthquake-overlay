import type { EmscProps } from './emsc.shared';

export type { EmscProps } from './emsc.shared';

export type Status = 'open' | 'lost' | 'closed';

/** Normalize seconds/ms/ISO → ISO or null */
function normalizeTimestamp(ts: string | number | undefined | null): string | null {
  try {
    if (ts == null) return null;
    if (typeof ts === 'number') {
      const ms = ts < 1e12 ? ts * 1000 : ts;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof ts === 'string') {
      const n = Number(ts);
      if (!Number.isNaN(n)) return normalizeTimestamp(n);
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

function resolveEndpoint(base: string, suffix: string): string {
  const trimmed = base.replace(/\/+$/, '');
  if (!trimmed) {
    return suffix.startsWith('/') ? suffix : `/${suffix}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    if (suffix.startsWith('/')) {
      return `${trimmed}${suffix}`;
    }
    return `${trimmed}/${suffix}`;
  }
  if (suffix.startsWith('/')) {
    return `${trimmed}${suffix}`;
  }
  return `${trimmed}/${suffix}`;
}

function resolveEventEndpoints(base: string) {
  const trimmed = base.trim();
  if (!trimmed) {
    return {
      stream: '/api/events/stream',
      latest: '/api/events/latest',
    };
  }

  if (/\/api\/events\/stream/.test(trimmed)) {
    return {
      stream: trimmed,
      latest: trimmed.replace(/\/stream\b.*/, '/latest'),
    };
  }

  return {
    stream: resolveEndpoint(trimmed, '/api/events/stream'),
    latest: resolveEndpoint(trimmed, '/api/events/latest'),
  };
}

function parseBackendEvent(raw: unknown): EmscProps | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const time = normalizeTimestamp(data.time ?? (data as any).timestamp);
  const lat = Number((data as any).lat ?? (data as any).latitude);
  const lon = Number((data as any).lon ?? (data as any).longitude);
  const mag = Number((data as any).mag ?? (data as any).magnitude);

  if (!time || Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(mag)) return null;

  const id =
    typeof data.unid === 'string' && data.unid.trim() !== ''
      ? data.unid.trim()
      : `${time}:${lat.toFixed(3)},${lon.toFixed(3)}`;

  const depth = typeof data.depth === 'number' ? data.depth : undefined;
  const magtype = typeof data.magtype === 'string' ? data.magtype : undefined;
  const province = typeof data.province === 'string' ? data.province : undefined;
  const flynn_region =
    typeof (data as any).flynn_region === 'string'
      ? (data as any).flynn_region
      : typeof (data as any).location === 'string'
        ? (data as any).location
        : undefined;

  return {
    unid: id,
    time,
    lat,
    lon,
    mag,
    depth,
    magtype,
    province,
    flynn_region,
  };
}

type ConnectOptions = {
  onEvent: (event: EmscProps) => void;
  onStatus?: (status: Status) => void;
  onSettings?: (settings: any) => void;
  urlOverride?: string;
};

/** ---- main connector ---------------------------------------------------- */
export function connectEMSC(options: ConnectOptions) {
  const { onEvent, onStatus, onSettings, urlOverride } = options;
  const env = (import.meta as any).env || {};
  const base = (urlOverride || env?.VITE_BACKEND_URL || '').trim();
  const { stream: streamUrl, latest: latestUrl } = resolveEventEndpoints(base);

  let closed = false;
  const notifyStatus = (status: Status) => {
    try { onStatus?.(status); } catch {}
  };

  const source = new EventSource(streamUrl);
  source.onopen = () => notifyStatus('open');
  source.onerror = () => {
    if (!closed) notifyStatus('lost');
  };

  source.addEventListener('status', (ev) => {
    const data = (ev as MessageEvent).data;
    const mapped = typeof data === 'string' ? data.toLowerCase() : '';
    if (mapped === 'open' || mapped === 'lost' || mapped === 'closed') {
      notifyStatus(mapped as Status);
    }
  });

  source.addEventListener('settings', (ev) => {
    try {
      const payload = JSON.parse((ev as MessageEvent).data);
      onSettings?.(payload);
    } catch {}
  });

  source.addEventListener('earthquake', (ev) => {
    try {
      const payload = JSON.parse((ev as MessageEvent).data);
      const parsed = parseBackendEvent(payload);
      if (parsed) onEvent(parsed);
    } catch {}
  });

  void (async () => {
    try {
      const res = await fetch(latestUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok || res.status === 204) return;
      const payload = await res.json();
      const parsed = parseBackendEvent(payload);
      if (parsed) onEvent(parsed);
    } catch {
      // ignore; SSE will deliver next live event
    }
  })();

  return () => {
    closed = true;
    notifyStatus('closed');
    try { source.close(); } catch {}
  };
}
