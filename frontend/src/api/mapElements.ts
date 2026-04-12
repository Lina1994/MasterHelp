import { api } from '../apiBase';

/**
 * Time-of-day intensity multiplier (0–1) for lights and windows.
 */
export interface TimeOfDayIntensity {
  dawn: number;
  morning: number;
  afternoon: number;
  night: number;
}

export type MapElementType = 'wall' | 'door' | 'window' | 'light' | 'sound';

/** Type of soundtrack source linked to a sound-source element. */
export type SoundSourceType = 'song' | 'playlist' | 'effect' | 'preset';

/** Wall — polyline that blocks light. Points normalised 0–1. */
export interface MapWallElement {
  id: string;
  type: 'wall';
  points: { x: number; y: number }[];
}

/** Door — 2-point segment, blocks light when closed. Points normalised 0–1. */
export interface MapDoorElement {
  id: string;
  type: 'door';
  points: [{ x: number; y: number }, { x: number; y: number }];
  isOpen: boolean;
  /** When true the master can interact with this door from the preview toolbar. */
  showInPreview?: boolean;
}

/** Window — 2-point segment, light passthrough varies by time of day. Points normalised 0–1. */
export interface MapWindowElement {
  id: string;
  type: 'window';
  points: [{ x: number; y: number }, { x: number; y: number }];
  lightByTimeOfDay: TimeOfDayIntensity;
  /** When true the master can see this window from the preview toolbar. */
  showInPreview?: boolean;
  /** When true the window is covered and does not dissipate any fog. */
  covered?: boolean;
}

/** Light source — reveals fog in a configurable radius. Position normalised 0–1. */
export interface MapLightElement {
  id: string;
  type: 'light';
  position: { x: number; y: number };
  /** Radius in pixels at the map's natural resolution. */
  radius: number;
  color?: string;
  isOn: boolean;
  /** When true the master can toggle this light from the preview toolbar. */
  showInPreview: boolean;
  label?: string;
  /** Per-time-of-day intensity multiplier; defaults to {dawn:1,morning:1,afternoon:1,night:1}. */
  intensityByTimeOfDay?: TimeOfDayIntensity;
}

/**
 * Sound-source element — emits proximity-based audio relative to allied tokens.
 * Position normalised 0–1.
 */
export interface MapSoundSourceElement {
  id: string;
  type: 'sound';
  position: { x: number; y: number };
  /** Radius in pixels at the map's natural resolution (audible range). */
  radius: number;
  /** Whether the source is currently playing. */
  isOn: boolean;
  /** When true the master can toggle this source from the preview toolbar. */
  showInPreview: boolean;
  label?: string;
  /** Base volume 0–1 (multiplied by distance attenuation). */
  volume: number;
  /** Kind of soundtrack asset linked. */
  sourceType?: SoundSourceType;
  /** UUID of the linked soundtrack asset. */
  sourceId?: string;
  /** Display name snapshot of the linked asset. */
  sourceName?: string;
}

/** Discriminated union of all structural map elements. */
export type MapElement = MapWallElement | MapDoorElement | MapWindowElement | MapLightElement | MapSoundSourceElement;

/**
 * Fetch map elements for a given map+campaign.
 * @param mapId Map UUID.
 * @param campaignId Campaign UUID.
 */
export async function getMapElements(mapId: string, campaignId: string): Promise<MapElement[]> {
  const res = await api.get<{ elements: MapElement[] }>(`/maps/${mapId}/elements`, { params: { campaignId } });
  return res.data?.elements ?? [];
}

/**
 * Upsert map elements for a given map+campaign.
 * @param mapId Map UUID.
 * @param campaignId Campaign UUID.
 * @param elements Full replacement array of elements.
 */
export async function setMapElements(mapId: string, campaignId: string, elements: MapElement[]): Promise<{ ok: boolean }> {
  const res = await api.patch<{ ok: boolean }>(`/maps/${mapId}/elements`, { campaignId, elements });
  return res.data;
}
