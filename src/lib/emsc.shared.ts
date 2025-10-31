export const LAST_EVENT_KEY = 'emscLastEventId';

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

export type GenericExternalMsg = {
  magnitude: number;
  location: { latitude: number; longitude: number };
  depth?: number; // km
  timestamp: string | number; // ISO string or epoch ms/s
};

export type CustomEventItem = {
  id: number | string;
  magnitude: number;
  location?: string;
  province?: string;
  latitude: number;
  longitude: number;
  depth?: number;
  event_time: string; // ISO time
};
