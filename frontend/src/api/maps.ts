import { api } from '../apiBase';

export interface MapItemDto {
  id: string;
  name: string;
  description?: string;
  group?: string;
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night';
  isWorldMap?: boolean;
  musicConfig?: Record<string, any>;
  sfxConfig?: Record<string, any>;
  campaignId?: string;
  imageAvailable: boolean;
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
  group?: string;
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night';
  isWorldMap?: boolean;
  musicConfig?: Record<string, any>;
  sfxConfig?: Record<string, any>;
}) {
  const form = new FormData();
  form.append('name', payload.name);
  if (payload.description) form.append('description', payload.description);
  if (payload.campaignId) form.append('campaignId', payload.campaignId);
  if (payload.file) form.append('file', payload.file);
  if (payload.group) form.append('group', payload.group);
  if (payload.timeOfDay) form.append('timeOfDay', payload.timeOfDay);
  if (payload.isWorldMap !== undefined) form.append('isWorldMap', String(payload.isWorldMap));
  if (payload.musicConfig) form.append('musicConfig', JSON.stringify(payload.musicConfig));
  if (payload.sfxConfig) form.append('sfxConfig', JSON.stringify(payload.sfxConfig));
  const res = await api.post<{ id: string }>('/maps', form);
  return res.data;
}

export async function updateMap(id: string, payload: {
  name?: string;
  description?: string;
  campaignId?: string;
  file?: File | null;
  group?: string;
  timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'night';
  isWorldMap?: boolean;
  musicConfig?: Record<string, any>;
  sfxConfig?: Record<string, any>;
}) {
  const form = new FormData();
  if (payload.name !== undefined) form.append('name', payload.name);
  if (payload.description !== undefined) form.append('description', payload.description);
  if (payload.campaignId !== undefined) form.append('campaignId', payload.campaignId);
  if (payload.file) form.append('file', payload.file);
  if (payload.group !== undefined) form.append('group', payload.group);
  if (payload.timeOfDay !== undefined) form.append('timeOfDay', payload.timeOfDay);
  if (payload.isWorldMap !== undefined) form.append('isWorldMap', String(payload.isWorldMap));
  if (payload.musicConfig !== undefined) form.append('musicConfig', JSON.stringify(payload.musicConfig));
  if (payload.sfxConfig !== undefined) form.append('sfxConfig', JSON.stringify(payload.sfxConfig));
  const res = await api.patch<{ ok: true }>(`/maps/${id}`, form);
  return res.data;
}

export async function deleteMap(id: string) {
  const res = await api.delete<{ ok: true }>(`/maps/${id}`);
  return res.data;
}

export function getMapImageUrl(id: string) {
  return `${api.defaults.baseURL}/maps/${id}/image`;
}

export function getMapImageUrlSized(id: string, size: 'thumb' | 'preview' | 'full') {
  const base = getMapImageUrl(id);
  const params = new URLSearchParams({ size }).toString();
  return `${base}?${params}`;
}

export async function createMapsBulk(files: File[], campaignId?: string) {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  if (campaignId) form.append('campaignId', campaignId);
  const res = await api.post<Array<{ id: string; name: string }>>('/maps/bulk', form);
  return res.data;
}
