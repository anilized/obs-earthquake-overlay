export type RevGeo = {
  city?: string;
  locality?: string;
  admin?: string;     // province/state
  countryName?: string;
}

type BigDataCloudResp = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
};

const CACHE = new Map<string, RevGeo>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6h soft TTL

function key(lat: number, lon: number) {
  // round to ~0.02° to improve cache hits (tune if you like)
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export async function reverseGeocodeCity(lat: number, lon: number, lang = 'en'): Promise<RevGeo> {
  const k = key(lat, lon);
  const hit = CACHE.get(k) as (RevGeo & { _ts?: number }) | undefined;
  if (hit && (Date.now() - (hit._ts || 0) < TTL_MS)) return hit;

  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('localityLanguage', lang);

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error(`revgeo ${res.status}`);
  const j = (await res.json()) as BigDataCloudResp;

  const data: RevGeo & { _ts: number } = {
    city: j.city || undefined,
    locality: j.locality || undefined,
    admin: j.principalSubdivision || undefined,
    countryName: j.countryName || undefined,
    _ts: Date.now(),
  };
  CACHE.set(k, data);
  return data;
}
