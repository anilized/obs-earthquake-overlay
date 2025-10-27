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

export function connectEMSC(onEvent: (p: EmscProps) => void) {
  const URL = 'wss://www.seismicportal.eu/standing_order/websocket';
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
