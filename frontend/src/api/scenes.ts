import { api } from '../apiBase';
import { getAuthHeaders } from '../utils/auth';
import type { ExecuteSceneResponse, Scene, SceneClockSyncResponse, SceneExecution, SceneLite, ScenePayload } from '../types/scenes';

export type { SceneLite } from '../types/scenes';

interface ListScenesOptions {
  campaignId?: string | null;
}

const normalizeScene = (raw: any): SceneLite => ({
  id: String(raw?.id || ''),
  name: String(raw?.name || ''),
  description: raw?.description ?? null,
  scope: raw?.scope || 'global',
  campaignId: raw?.campaignId ?? raw?.campaign?.id ?? null,
});

/**
 * Lists scenes available to the current user.
 */
export async function listScenes(options?: ListScenesOptions): Promise<SceneLite[]> {
  const response = await api.get('/scenes', {
    headers: getAuthHeaders(),
    params: options?.campaignId ? { campaignId: options.campaignId } : undefined,
  });
  return Array.isArray(response.data) ? response.data.map(normalizeScene) : [];
}

/**
 * Executes one scene and returns the backend-built runtime plan.
 */
export async function executeScene(sceneId: string): Promise<ExecuteSceneResponse> {
  const response = await api.post(`/scenes/${sceneId}/execute`, {}, { headers: getAuthHeaders() });
  return {
    ...response.data,
    scene: normalizeScene(response.data?.scene),
    commands: Array.isArray(response.data?.commands) ? response.data.commands : [],
  } as ExecuteSceneResponse;
}

/**
 * Fetches a lightweight server clock sample for scheduler calibration.
 */
export async function getSceneClockSync(): Promise<SceneClockSyncResponse> {
  const response = await api.get('/scenes/clock-sync', { headers: getAuthHeaders() });
  return response.data as SceneClockSyncResponse;
}

/**
 * Fetches a single scene by ID with full action list.
 */
export async function getScene(id: string): Promise<Scene> {
  const response = await api.get(`/scenes/${id}`, {
    headers: getAuthHeaders(),
    params: { _t: Date.now() },
  });
  return response.data as Scene;
}

/**
 * Creates a new scene.
 */
export async function createScene(payload: ScenePayload): Promise<Scene> {
  const response = await api.post('/scenes', payload, { headers: getAuthHeaders() });
  return response.data as Scene;
}

/**
 * Updates an existing scene.
 */
export async function updateScene(id: string, payload: Partial<ScenePayload>): Promise<Scene> {
  const response = await api.patch(`/scenes/${id}`, payload, { headers: getAuthHeaders() });
  return response.data as Scene;
}

/**
 * Deletes a scene by ID.
 */
export async function deleteScene(id: string): Promise<void> {
  await api.delete(`/scenes/${id}`, { headers: getAuthHeaders() });
}

/**
 * Lists recent execution history for the current user.
 */
export async function listSceneExecutions(): Promise<SceneExecution[]> {
  const response = await api.get('/scenes/executions/history', { headers: getAuthHeaders() });
  return Array.isArray(response.data) ? response.data : [];
}

/**
 * Fetches a single execution record by ID.
 */
export async function getSceneExecution(executionId: string): Promise<SceneExecution> {
  const response = await api.get(`/scenes/executions/${executionId}`, { headers: getAuthHeaders() });
  return response.data as SceneExecution;
}
