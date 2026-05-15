export type SceneScope = 'global' | 'campaign';

export type SceneWindowTargetKind = 'main' | 'projection' | 'skyline' | 'custom' | 'instance';

export interface SceneWindowTarget {
  kind: SceneWindowTargetKind;
  windowId?: string;
  windowType?: string;
}

export interface SceneActionBase {
  id: string;
  type: SceneActionType;
  delay?: number;
  targetWindow?: SceneWindowTarget;
}

export interface PlayMusicSceneAction extends SceneActionBase {
  type: 'playMusic';
  payload: {
    songId?: string;
    playlistId?: string;
    loop?: boolean;
    volume?: number;
  };
}

export interface StopMusicSceneAction extends SceneActionBase {
  type: 'stopMusic';
  payload?: {
    stopEffects?: boolean;
  };
}

export interface PlaySoundSceneAction extends SceneActionBase {
  type: 'playSound';
  payload: {
    effectId: string;
    volume?: number;
    loopMode?: 'once' | 'continuous' | 'fixed' | 'random';
    waitMs?: number;
    randomMinMs?: number;
    randomMaxMs?: number;
  };
}

export interface SetMusicVolumeSceneAction extends SceneActionBase {
  type: 'setMusicVolume';
  payload: {
    value: number;
  };
}

export interface SendImageToWindowSceneAction extends SceneActionBase {
  type: 'sendImageToWindow';
  payload: {
    imageUrl: string;
    title?: string;
  };
}

export interface SendVideoToWindowSceneAction extends SceneActionBase {
  type: 'sendVideoToWindow';
  payload: {
    videoAssetId?: string;
    videoUrl?: string;
    loop?: boolean;
    muted?: boolean;
  };
}

export interface SetWindowBackgroundSceneAction extends SceneActionBase {
  type: 'setWindowBackground';
  payload: {
    imageUrl: string;
    sizing?: 'cover' | 'contain' | 'stretch';
  };
}

export interface ApplyWindowFilterSceneAction extends SceneActionBase {
  type: 'applyWindowFilter';
  payload: {
    filter: string;
    intensity?: number;
    color?: string;
  };
}

export interface ClearWindowFilterSceneAction extends SceneActionBase {
  type: 'clearWindowFilter';
  payload?: Record<string, never>;
}

export interface SetWeatherSceneAction extends SceneActionBase {
  type: 'setWeather';
  payload: {
    preset: string;
    intensity?: number;
    durationMs?: number;
  };
}

export interface SetNarrativeTextSceneAction extends SceneActionBase {
  type: 'setNarrativeText';
  payload: {
    text: string;
    title?: string;
    durationMs?: number;
  };
}

export interface RunShortcutSceneAction extends SceneActionBase {
  type: 'runShortcut';
  payload: {
    shortcutId: string;
  };
}

export interface DelaySceneAction extends SceneActionBase {
  type: 'delay';
  payload: {
    durationMs: number;
  };
}

export interface RunSceneSceneAction extends SceneActionBase {
  type: 'runScene';
  payload: {
    sceneId: string;
  };
}

export type SceneActionDefinition =
  | PlayMusicSceneAction
  | StopMusicSceneAction
  | PlaySoundSceneAction
  | SetMusicVolumeSceneAction
  | SendImageToWindowSceneAction
  | SendVideoToWindowSceneAction
  | SetWindowBackgroundSceneAction
  | ApplyWindowFilterSceneAction
  | ClearWindowFilterSceneAction
  | SetWeatherSceneAction
  | SetNarrativeTextSceneAction
  | RunShortcutSceneAction
  | DelaySceneAction
  | RunSceneSceneAction;

export type SceneActionType = SceneActionDefinition['type'];

export const SCENE_ACTION_TYPES: readonly SceneActionType[] = [
  'playMusic',
  'stopMusic',
  'playSound',
  'setMusicVolume',
  'sendImageToWindow',
  'sendVideoToWindow',
  'setWindowBackground',
  'applyWindowFilter',
  'clearWindowFilter',
  'setWeather',
  'setNarrativeText',
  'runShortcut',
  'delay',
  'runScene',
];

export const SCENE_WINDOW_TARGET_KINDS: readonly SceneWindowTargetKind[] = [
  'main',
  'projection',
  'skyline',
  'custom',
  'instance',
];

export type SceneExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type SceneTriggerSource = 'manual' | 'shortcut' | 'scene';

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

export interface SceneRuntimeCommand {
  actionId: string;
  kind: SceneRuntimeCommandKind;
  payload: Record<string, unknown>;
  targetWindow?: SceneWindowTarget;
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

export const SCENE_SCHEMA_VERSION = 1;
export const SCENE_MAX_ACTIONS = 48;
export const SCENE_MAX_DEPTH = 5;
export const SCENE_MAX_TOTAL_DELAY_MS = 30 * 60 * 1000;