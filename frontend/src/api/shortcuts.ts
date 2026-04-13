import { api } from '../apiBase';
import { getAuthHeaders } from '../utils/auth';
import type { ShortcutItem, ShortcutPayload, SoundEffectOption } from '../types/shortcuts';

/**
 * Lists all shortcuts owned by the current user.
 */
export async function listShortcuts(): Promise<ShortcutItem[]> {
  const response = await api.get('/shortcuts', { headers: getAuthHeaders() });
  return response.data;
}

/**
 * Creates a new shortcut.
 */
export async function createShortcut(payload: ShortcutPayload): Promise<ShortcutItem> {
  const response = await api.post('/shortcuts', payload, { headers: getAuthHeaders() });
  return response.data;
}

/**
 * Updates an existing shortcut.
 */
export async function updateShortcut(id: string, payload: Partial<ShortcutPayload>): Promise<ShortcutItem> {
  const response = await api.patch(`/shortcuts/${id}`, payload, { headers: getAuthHeaders() });
  return response.data;
}

/**
 * Removes a shortcut.
 */
export async function deleteShortcut(id: string): Promise<void> {
  await api.delete(`/shortcuts/${id}`, { headers: getAuthHeaders() });
}

/**
 * Executes a shortcut and returns the updated persisted state.
 */
export async function executeShortcut(id: string): Promise<ShortcutItem> {
  const response = await api.post(`/shortcuts/${id}/execute`, undefined, { headers: getAuthHeaders() });
  return response.data;
}

/**
 * Loads sound effects available to the current campaign or globally.
 */
export async function listShortcutSoundEffects(campaignId?: string | null): Promise<SoundEffectOption[]> {
  if (campaignId) {
    const response = await api.get(`/soundtrack/effects/campaigns/${campaignId}`, { headers: getAuthHeaders() });
    return [...response.data.associated, ...response.data.reusable];
  }
  const response = await api.get('/soundtrack/effects', { headers: getAuthHeaders() });
  return response.data;
}