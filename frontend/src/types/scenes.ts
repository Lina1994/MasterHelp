export type SceneRuntimeCommandKind =
  | 'audio.playMusic'
  | 'audio.stopMusic'
  | 'audio.playSound'
  | 'audio.setMusicVolume'
  | 'window.sendImage'
  | 'window.sendVideo'
  | 'window.setBackground'
  | 'window.applyFilter'
  | 'window.clearFilter'
  | 'weather.set'
  | 'narrative.setText'
  | 'shortcut.execute';

export interface SceneWindowTarget {
  kind: 'main' | 'projection' | 'skyline' | 'custom' | 'instance';
  windowId?: string;
  windowType?: string;
}

export interface SceneRuntimeCommand {
  actionId: string;
  kind: SceneRuntimeCommandKind;
  payload: Record<string, unknown>;
  targetWindow?: SceneWindowTarget;
  dispatchedAtMs?: number;
  executionId?: string;
  scheduleVersion?: number;
  serverNowMs?: number;
  startAtMs?: number;
  sequence?: number;
  executeAtMs?: number;
  issuedAtOffsetMs: number;
}

export interface SceneExecutionSummary {
  totalActions: number;
  completedActions: number;
  emittedCommands: number;
  nestedScenes: number;
  nestedShortcuts: number;
  totalDelayMs: number;
}

export interface SceneLite {
  id: string;
  name: string;
  description?: string | null;
  scope?: 'global' | 'campaign';
  campaignId?: string | null;
}

/** Full scene object returned by GET /scenes/:id */
export interface Scene extends SceneLite {
  schemaVersion: number;
  actions: SceneActionDto[];
  createdAt?: string;
  updatedAt?: string;
}

/** Shape of a single scene action (frontend representation) */
export interface SceneActionDto {
  id: string;
  type: string;
  delay?: number;
  targetWindow?: SceneWindowTarget;
  payload: Record<string, unknown>;
}

export interface SceneChromaKeySettings {
  enabled: boolean;
  color: string;
  tolerance: number;
}

/** Payload for creating or updating a scene */
export interface ScenePayload {
  name: string;
  description?: string | null;
  scope: 'global' | 'campaign';
  campaignId?: string | null;
  actions: SceneActionDto[];
}

/** Single execution history record */
export interface SceneExecution {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: string;
  finishedAt?: string;
  currentActionIndex?: number;
  emittedCommands?: SceneRuntimeCommand[];
  summary?: SceneExecutionSummary;
  scene?: SceneLite;
}

/** Persisted scene video metadata record. */
export interface SceneVideoAsset {
  id: string;
  name: string;
  description?: string | null;
  originalFilename: string;
  mimeType: string;
  size: number;
  checksumSha256: string;
  relativePath: string;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed';
  processingError?: string | null;
  campaign?: { id: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Signed URL response for video stream playback. */
export interface SceneVideoSignedStreamUrlResponse {
  url: string;
  expiresAt: number;
}

export interface ExecuteSceneResponse {
  executionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  scene: SceneLite;
  scheduleVersion?: number;
  serverNowMs?: number;
  startAtMs?: number;
  commands: SceneRuntimeCommand[];
  summary: SceneExecutionSummary;
}

export interface SceneClockSyncResponse {
  serverNowMs: number;
  scheduleVersion: number;
  leadMs: number;
}
