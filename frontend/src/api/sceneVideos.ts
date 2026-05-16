import { api } from '../apiBase';
import { getAuthHeaders } from '../utils/auth';
import type {
  CreateSceneVideoClipPayload,
  SceneVideoAsset,
  SceneVideoDerivationStatusResponse,
  SceneVideoSignedStreamUrlResponse,
} from '../types/scenes';

interface UploadSceneVideoOptions {
  name?: string;
  description?: string;
  campaignId?: string;
}

interface UpdateSceneVideoOptions {
  name?: string;
  description?: string;
}

const SCENE_VIDEOS_BASE_PATH = '/scenes/videos';

function mapSceneVideosError(error: any): never {
  const status = Number(error?.response?.status);
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');

  if (code === 'ERR_NETWORK' || message.includes('ECONNREFUSED') || message.includes('Network Error')) {
    throw new Error(
      'No se pudo conectar con el backend en http://localhost:3000. Verifica que el backend este iniciado antes de subir videos.',
    );
  }

  if (status === 404) {
    throw new Error(
      'El backend activo no expone /scenes/videos (404). Si usas la app empaquetada, recompila/reinstala para incluir el backend actualizado; si usas entorno dev, reinicia backend desde esta carpeta del proyecto.',
    );
  }
  throw error;
}

/**
 * Uploads one scene video asset.
 */
export async function uploadSceneVideo(
  file: File,
  options?: UploadSceneVideoOptions,
): Promise<SceneVideoAsset> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.name) formData.append('name', options.name);
  if (options?.description) formData.append('description', options.description);
  if (options?.campaignId) formData.append('campaignId', options.campaignId);

  try {
    const response = await api.post(`${SCENE_VIDEOS_BASE_PATH}/upload`, formData, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data as SceneVideoAsset;
  } catch (error: any) {
    return mapSceneVideosError(error);
  }
}

/**
 * Lists scene video assets visible to the current user.
 */
export async function listSceneVideos(campaignId?: string): Promise<SceneVideoAsset[]> {
  try {
    const response = await api.get(SCENE_VIDEOS_BASE_PATH, {
      headers: getAuthHeaders(),
      params: campaignId ? { campaignId } : undefined,
    });

    return Array.isArray(response.data) ? (response.data as SceneVideoAsset[]) : [];
  } catch (error: any) {
    return mapSceneVideosError(error);
  }
}

/**
 * Creates a temporary signed URL for playback in video tags.
 */
export async function createSceneVideoSignedUrl(
  videoId: string,
  ttlSeconds?: number,
): Promise<SceneVideoSignedStreamUrlResponse> {
  try {
    const response = await api.post(
      `${SCENE_VIDEOS_BASE_PATH}/${videoId}/signed-stream-url`,
      ttlSeconds ? { ttlSeconds } : {},
      { headers: getAuthHeaders() },
    );

    return response.data as SceneVideoSignedStreamUrlResponse;
  } catch (error: any) {
    return mapSceneVideosError(error);
  }
}

/**
 * Requests asynchronous clip derivation from one source scene video.
 */
export async function createSceneVideoClip(
  sourceVideoId: string,
  payload: CreateSceneVideoClipPayload,
): Promise<SceneVideoAsset> {
  try {
    const response = await api.post(
      `${SCENE_VIDEOS_BASE_PATH}/${sourceVideoId}/create-clip`,
      payload,
      { headers: getAuthHeaders() },
    );

    return response.data as SceneVideoAsset;
  } catch (error: any) {
    return mapSceneVideosError(error);
  }
}

/**
 * Reads processing/derivation status for one scene video asset.
 */
export async function getSceneVideoDerivationStatus(
  videoId: string,
): Promise<SceneVideoDerivationStatusResponse> {
  try {
    const response = await api.get(`${SCENE_VIDEOS_BASE_PATH}/${videoId}/derivation-status`, {
      headers: getAuthHeaders(),
    });
    return response.data as SceneVideoDerivationStatusResponse;
  } catch (error: any) {
    return mapSceneVideosError(error);
  }
}

/**
 * Deletes one owned scene video asset.
 */
export async function deleteSceneVideo(videoId: string): Promise<void> {
  try {
    await api.delete(`${SCENE_VIDEOS_BASE_PATH}/${videoId}`, { headers: getAuthHeaders() });
  } catch (error: any) {
    mapSceneVideosError(error);
  }
}

/**
 * Updates mutable metadata of one owned scene video asset.
 */
export async function updateSceneVideo(
  videoId: string,
  options: UpdateSceneVideoOptions,
): Promise<SceneVideoAsset> {
  try {
    const response = await api.patch(`${SCENE_VIDEOS_BASE_PATH}/${videoId}`, options, {
      headers: getAuthHeaders(),
    });
    return response.data as SceneVideoAsset;
  } catch (error: any) {
    return mapSceneVideosError(error);
  }
}
