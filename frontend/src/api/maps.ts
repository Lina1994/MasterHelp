import { api } from '../apiBase';

export interface MapItemDto {
  id: string;
  name: string;
  description?: string;
  group?: string[];
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night';
  isWorldMap?: boolean;
  musicConfig?: Record<string, any>;
  sfxConfig?: Record<string, any>;
  transform?: { zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number };
  campaignId?: string;
  imageAvailable: boolean;
  skylineAvailable?: boolean;
  updatedAt: string;
  createdAt: string;
}

export async function listMaps(params: { q?: string; campaignId?: string } = {}) {
  const res = await api.get<MapItemDto[]>('/maps', { params });
  return res.data;
}

export async function createMap(payload: {
  name: string;
  description?: string;
  campaignId?: string;
  file?: File | null;
  group?: string[];
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night';
  isWorldMap?: boolean;
  musicConfig?: Record<string, any>;
  sfxConfig?: Record<string, any>;
  transform?: { zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number };
}) {
  const form = new FormData();
  form.append('name', payload.name);
  if (payload.description) form.append('description', payload.description);
  if (payload.campaignId) form.append('campaignId', payload.campaignId);
  if (payload.file) form.append('file', payload.file);
  if (payload.group && payload.group.length) form.append('group', JSON.stringify(payload.group));
  if (payload.timeOfDay !== undefined) {
    const allowed = ['', 'dawn', 'morning', 'afternoon', 'night'] as const;
    const val = (payload.timeOfDay as any) ?? '';
    const send = (allowed as readonly string[]).includes(val) ? val : '';
    form.append('timeOfDay', send);
  }
  if (payload.isWorldMap !== undefined) form.append('isWorldMap', String(payload.isWorldMap));
  if (payload.musicConfig) form.append('musicConfig', JSON.stringify(payload.musicConfig));
  if (payload.sfxConfig) form.append('sfxConfig', JSON.stringify(payload.sfxConfig));
  if (payload.transform) form.append('transform', JSON.stringify(payload.transform));
  if ((import.meta as any).env?.DEV) {
    // eslint-disable-next-line no-console
    console.log('[createMap] form entries:', Array.from(form.entries()).map(([k, v]) => [k, typeof v === 'string' ? v : (v as File).name]));
  }
  const res = await api.post<{ id: string }>('/maps', form);
  return res.data;
}

export async function updateMap(id: string, payload: {
  name?: string;
  description?: string;
  campaignId?: string;
  file?: File | null;
  group?: string[];
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night';
  isWorldMap?: boolean;
  musicConfig?: Record<string, any>;
  sfxConfig?: Record<string, any>;
  imageTimeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night';
  transform?: { zoom?: number; rotationDeg?: number; translateXPct?: number; translateYPct?: number };
}) {
  const form = new FormData();
  if (payload.name !== undefined) form.append('name', payload.name);
  if (payload.description !== undefined) form.append('description', payload.description);
  if (payload.campaignId !== undefined) form.append('campaignId', payload.campaignId);
  if (payload.file) form.append('file', payload.file);
  if (payload.group !== undefined) form.append('group', JSON.stringify(payload.group));
  if (payload.timeOfDay !== undefined) {
    const allowed = ['', 'dawn', 'morning', 'afternoon', 'night'] as const;
    const val = (payload.timeOfDay as any) ?? '';
    const send = (allowed as readonly string[]).includes(val) ? val : '';
    form.append('timeOfDay', send);
  }
  if (payload.isWorldMap !== undefined) form.append('isWorldMap', String(payload.isWorldMap));
  if (payload.musicConfig !== undefined) form.append('musicConfig', JSON.stringify(payload.musicConfig));
  if (payload.sfxConfig !== undefined) form.append('sfxConfig', JSON.stringify(payload.sfxConfig));
  if (payload.transform !== undefined) form.append('transform', JSON.stringify(payload.transform));
  const params: Record<string, string> = {};
  if (payload.imageTimeOfDay) params['imageTimeOfDay'] = payload.imageTimeOfDay;
  if ((import.meta as any).env?.DEV) {
    // eslint-disable-next-line no-console
    console.log('[updateMap] form entries:', Array.from(form.entries()).map(([k, v]) => [k, typeof v === 'string' ? (v.length > 200 ? v.slice(0, 200) + '…' : v) : (v as File).name]));
    // eslint-disable-next-line no-console
    console.log('[updateMap] query params:', params);
  }
  const res = await api.patch<{ ok: true }>(`/maps/${id}`, form, { params });
  return res.data;
}

export async function deleteMap(id: string) {
  const res = await api.delete<{ ok: true }>(`/maps/${id}`);
  return res.data;
}

export function getMapImageUrl(id: string, opts?: { timeOfDay?: 'dawn'|'morning'|'afternoon'|'night'; cacheBust?: string | number; strict?: boolean }) {
  const base = `${api.defaults.baseURL}/maps/${id}/image`;
  const params = new URLSearchParams();
  if (opts?.timeOfDay) params.set('timeOfDay', opts.timeOfDay);
  if (opts?.cacheBust !== undefined) params.set('_cb', String(opts.cacheBust));
  if (opts?.strict) params.set('strict', '1');
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function getMapImageUrlSized(id: string, size: 'thumb' | 'preview' | 'full', opts?: { timeOfDay?: 'dawn'|'morning'|'afternoon'|'night'; cacheBust?: string | number; strict?: boolean }) {
  const base = getMapImageUrl(id, opts);
  const params = new URLSearchParams({ size }).toString();
  return base.includes('?') ? `${base}&${params}` : `${base}?${params}`;
}

// SKYLINE API
export function getMapSkylineUrl(id: string, opts?: { timeOfDay?: 'dawn'|'morning'|'afternoon'|'night'; cacheBust?: string | number; strict?: boolean }) {
  const base = `${api.defaults.baseURL}/maps/${id}/skyline`;
  const params = new URLSearchParams();
  if (opts?.timeOfDay) params.set('timeOfDay', opts.timeOfDay);
  if (opts?.cacheBust !== undefined) params.set('_cb', String(opts.cacheBust));
  if (opts?.strict) params.set('strict', '1');
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function getMapSkylineUrlSized(id: string, size: 'thumb' | 'preview' | 'full', opts?: { timeOfDay?: 'dawn'|'morning'|'afternoon'|'night'; cacheBust?: string | number; strict?: boolean }) {
  const base = getMapSkylineUrl(id, opts);
  const params = new URLSearchParams({ size }).toString();
  return base.includes('?') ? `${base}&${params}` : `${base}?${params}`;
}

export async function uploadMapSkylineForTod(
  id: string,
  file: File,
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night',
) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ ok: true }>(`/maps/${id}/skyline`, form, { params: { timeOfDay } });
  return res.data;
}

export async function hasMapSkylineForTod(
  id: string,
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night',
  size: 'thumb' | 'preview' | 'full' = 'preview',
) {
  try {
    await api.get(`/maps/${id}/skyline`, { params: { size, timeOfDay, strict: '1' }, responseType: 'arraybuffer' });
    return true;
  } catch (e: any) {
    if (e?.response?.status === 404) return false;
    throw e;
  }
}

export async function createMapsBulk(files: File[], campaignId?: string) {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  if (campaignId) form.append('campaignId', campaignId);
  const res = await api.post<Array<{ id: string; name: string }>>('/maps/bulk', form);
  return res.data;
}

/**
 * Returns total storage usage (bytes) across all maps and the number of maps for the current user.
 * Optionally filter by campaignId.
 */
export async function getMapsUsage(params: { campaignId?: string } = {}) {
  const res = await api.get<{ totalSize: number; count: number }>(`/maps/usage`, { params });
  return res.data;
}

/**
 * Uploads an image to be used specifically for a given time-of-day, without altering other TOD images.
 *
 * When successful, the backend stores thumb/preview/full variants for the provided timeOfDay.
 */
export async function uploadMapImageForTod(
  id: string,
  file: File,
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night',
) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ ok: true }>(`/maps/${id}/image`, form, { params: { timeOfDay } });
  return res.data;
}

/**
 * Checks whether a specific time-of-day image exists without falling back to base/any.
 * Returns true on 200, false on 404. Other errors are thrown.
 */
export async function hasMapImageForTod(
  id: string,
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'night',
  size: 'thumb' | 'preview' | 'full' = 'preview',
) {
  try {
    await api.get(`/maps/${id}/image`, { params: { size, timeOfDay, strict: '1' }, responseType: 'arraybuffer' });
    return true;
  } catch (e: any) {
    if (e?.response?.status === 404) return false;
    throw e;
  }
}

// TOKENS API
export type TokenSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

export type MapTokenPayload = {
  id: string;
  cellKey: string;
  type: 'ally' | 'enemy';
  label?: string;
  color?: string;
  /** Visual facing direction in degrees (0..360). */
  rotationDeg?: number;
  /** Size of the token (default: medium). */
  size?: TokenSize;
  /** Original size before any manual adjustments (to allow reset). */
  originalSize?: TokenSize;
  /** Orientation for hex grids (0-5 for Large/Gargantuan tokens). */
  orientation?: number;
};

export async function getMapTokens(mapId: string, campaignId: string) {
  const res = await api.get<{ tokens: MapTokenPayload[] }>(`/maps/${mapId}/tokens`, { params: { campaignId } });
  return (res.data?.tokens ?? []) as MapTokenPayload[];
}

export async function setMapTokens(mapId: string, campaignId: string, tokens: MapTokenPayload[]) {
  const res = await api.patch<{ ok: true }>(`/maps/${mapId}/tokens`, { campaignId, tokens });
  return res.data;
}

// ─── World-Map Markers API ───────────────────────────────────────────────────

/**
 * Represents a set of associated entity IDs linked to a world-map marker.
 * All values are UUIDs; display data must be resolved client-side.
 */
export interface MarkerAssociated {
  mapIds?: string[];
  characterIds?: string[];
  enemyIds?: string[];
  encounterIds?: string[];
  diarySessionIds?: string[];
  /** UUIDs of DiaryEntry records (calendar day entries). */
  diaryEntryIds?: string[];
  worldpediaIds?: string[];
}

/** Full DTO for a world-map marker as returned by the API. */
export interface MapMarkerDto {
  id: string;
  mapId: string;
  campaignId: string;
  name: string;
  icon: string;
  notes: string | null;
  /** Horizontal position as percentage of map image width (0–100). */
  x: number;
  /** Vertical position as percentage of map image height (0–100). */
  y: number;
  associated: MarkerAssociated | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lists all markers for a given map in a campaign.
 *
 * @param mapId      - UUID of the MapEntity.
 * @param campaignId - Campaign scope for the markers.
 */
export async function listMapMarkers(mapId: string, campaignId: string): Promise<MapMarkerDto[]> {
  const res = await api.get<MapMarkerDto[]>(`/maps/${mapId}/markers`, { params: { campaignId } });
  return res.data;
}

/**
 * Creates a new marker on a world-map.
 *
 * @param mapId   - UUID of the MapEntity.
 * @param payload - Marker creation data.
 */
export async function createMapMarker(
  mapId: string,
  payload: {
    name: string;
    icon?: string;
    notes?: string;
    x: number;
    y: number;
    campaignId: string;
    associated?: MarkerAssociated;
  },
): Promise<MapMarkerDto> {
  const res = await api.post<MapMarkerDto>(`/maps/${mapId}/markers`, payload);
  return res.data;
}

/**
 * Applies a partial update to an existing marker (PATCH semantics).
 *
 * @param mapId    - UUID of the MapEntity.
 * @param markerId - UUID of the marker to update.
 * @param patch    - Partial marker data to update.
 */
export async function updateMapMarker(
  mapId: string,
  markerId: string,
  patch: Partial<Omit<MapMarkerDto, 'id' | 'mapId' | 'campaignId' | 'createdAt' | 'updatedAt'>>,
): Promise<MapMarkerDto> {
  const res = await api.patch<MapMarkerDto>(`/maps/${mapId}/markers/${markerId}`, patch);
  return res.data;
}

/**
 * Deletes a marker permanently.
 *
 * @param mapId    - UUID of the MapEntity.
 * @param markerId - UUID of the marker to delete.
 */
export async function deleteMapMarker(mapId: string, markerId: string): Promise<{ ok: true }> {
  const res = await api.delete<{ ok: true }>(`/maps/${mapId}/markers/${markerId}`);
  return res.data;
}
