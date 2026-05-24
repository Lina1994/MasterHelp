export type SceneRuntimeCommandKind =
  | 'audio.playMusic'
  | 'audio.playPreset'
  | 'audio.stopMusic'
  | 'audio.playSound'
  | 'audio.setMusicVolume'
  | 'audio.stopSound'
  | 'audio.setSoundVolume'
  | 'scene.stopExecution'
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
  logicalExecutionId?: string;
  loopCycleIndex?: number;
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
  icon?: string | null;
  imageUrl?: string | null;
  loop?: boolean;
  loopDelayMs?: number | null;
  loopDelayRandomMinMs?: number | null;
  loopDelayRandomMaxMs?: number | null;
  loopWindowStartMs?: number | null;
  loopWindowEndMs?: number | null;
  takeOverMusicOnStart?: boolean;
  restorePreviousMusicOnFinish?: boolean;
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
export interface SceneActionClipMetadata {
  splitGroupId?: string | null;
  splitIndex?: number | null;
  splitTotal?: number | null;
  parentActionId?: string | null;
  clipInSec?: number | null;
  clipOutSec?: number | null;
  clipDurationMs?: number | null;
}

export interface SceneActionDto {
  id: string;
  type: string;
  delay?: number;
  targetWindow?: SceneWindowTarget;
  payload: Record<string, unknown> & SceneActionClipMetadata;
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
  icon?: string | null;
  imageUrl?: string | null;
  loop?: boolean;
  loopDelayMs?: number | null;
  loopDelayRandomMinMs?: number | null;
  loopDelayRandomMaxMs?: number | null;
  loopWindowStartMs?: number | null;
  loopWindowEndMs?: number | null;
  takeOverMusicOnStart?: boolean;
  restorePreviousMusicOnFinish?: boolean;
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
  derivationType?: 'original' | 'clip';
  parentVideoId?: string | null;
  sourceStartSec?: number | null;
  sourceEndSec?: number | null;
  campaign?: { id: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Signed URL response for video stream playback. */
export interface SceneVideoSignedStreamUrlResponse {
  url: string;
  expiresAt: number;
}

export interface CreateSceneVideoClipPayload {
  startSec: number;
  endSec: number;
  name?: string;
}

export interface SceneVideoDerivationStatusResponse {
  id: string;
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed';
  processingError?: string | null;
  derivationType: 'original' | 'clip';
  parentVideoId?: string | null;
  sourceStartSec?: number | null;
  sourceEndSec?: number | null;
  updatedAt: string;
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

// ---------------------------------------------------------------------------
// Motion & Transform types
// ---------------------------------------------------------------------------

/** Easing function applied from one keyframe to the next. */
export type MotionEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'spring';

/**
 * A single keyframe in a layer motion path.
 * timeMs=0 maps to the action's starting position (leftPct/topPct in payload).
 */
export interface MotionKeyframe {
  /** Milliseconds from action start. */
  timeMs: number;
  /** X position as % of stage width. */
  leftPct: number;
  /** Y position as % of stage height. */
  topPct: number;
  /** Optional pause duration at this keyframe before moving to the next one. */
  holdMs?: number;
  /** Whether oscillation should freeze while this keyframe hold is active. */
  pauseOscillationDuringHold?: boolean;
  /** Optional rotation in degrees at this keyframe. Interpolated from prev keyframe. */
  rotation?: number;
  /** Optional horizontal flip at this keyframe (step change). */
  flipH?: boolean;
  /** Optional vertical flip at this keyframe (step change). */
  flipV?: boolean;
  /** Easing applied from this keyframe to the next one. */
  easing: MotionEasing;
}

/**
 * Secondary oscillation effect superimposed on the motion path.
 * 'wave' = smooth sinusoidal; 'bounce' = abrupt sawtooth (walk cycle feel).
 */
export interface OscillationEffect {
  enabled: boolean;
  type: 'wave' | 'bounce';
  axis: 'x' | 'y' | 'both';
  /** Amplitude as % of stage (e.g. 3 = ±3%). */
  amplitudePct: number;
  /** Oscillations per second (e.g. 2 = 2 bounces/sec). */
  frequencyHz: number;
  /** When true, the oscillation phase is frozen while motion-path holds are active. */
  pauseDuringMotionHold?: boolean;
}
