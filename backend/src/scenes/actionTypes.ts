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

export interface SceneSplitMetadata {
  splitGroupId?: string;
  splitIndex?: number;
  splitTotal?: number;
  parentActionId?: string;
}

export interface SceneClipTimingMetadata extends SceneSplitMetadata {
  clipInSec?: number;
  clipOutSec?: number;
  clipDurationMs?: number;
}

export interface PlayMusicSceneAction extends SceneActionBase {
  type: 'playMusic';
  payload: {
    songId?: string;
    playlistId?: string;
    loop?: boolean;
    volume?: number;
    durationMs?: number;
    timelineStartMs?: number;
  } & SceneClipTimingMetadata;
}

export interface PlayPresetSceneAction extends SceneActionBase {
  type: 'playPreset';
  payload: {
    presetId: string;
    volume?: number;
    durationMs?: number;
    timelineStartMs?: number;
    playbackRate?: number;
    pitchSemitones?: number;
    echoEnabled?: boolean;
    echoDelayMs?: number;
    echoFeedback?: number;
    filterType?: 'none' | 'lowpass' | 'highpass' | 'bandpass';
    filterFrequency?: number;
    filterQ?: number;
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
    durationMs?: number;
    timelineStartMs?: number;
    playbackRate?: number;
    pitchSemitones?: number;
    echoEnabled?: boolean;
    echoDelayMs?: number;
    echoFeedback?: number;
    filterType?: 'none' | 'lowpass' | 'highpass' | 'bandpass';
    filterFrequency?: number;
    filterQ?: number;
    loopMode?: 'once' | 'continuous' | 'fixed' | 'random';
    waitMs?: number;
    randomMinMs?: number;
    randomMaxMs?: number;
  } & SceneClipTimingMetadata;
}

export interface SetMusicVolumeSceneAction extends SceneActionBase {
  type: 'setMusicVolume';
  payload: {
    value: number;
  };
}

export interface StopSoundSceneAction extends SceneActionBase {
  type: 'stopSound';
  payload?: {
    effectId?: string;
  };
}

export interface SetSoundVolumeSceneAction extends SceneActionBase {
  type: 'setSoundVolume';
  payload: {
    value: number;
    effectId?: string;
  };
}

type MotionKeyframeBackend = {
  timeMs: number;
  leftPct: number;
  topPct: number;
  holdMs?: number;
  pauseOscillationDuringHold?: boolean;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'spring';
};

type OscillationEffectBackend = {
  enabled: boolean;
  type: 'wave' | 'bounce';
  axis: 'x' | 'y' | 'both';
  amplitudePct: number;
  frequencyHz: number;
  pauseDuringMotionHold?: boolean;
};

export interface SendImageToWindowSceneAction extends SceneActionBase {
  type: 'sendImageToWindow';
  payload: {
    imageUrl: string;
    title?: string;
    opacity?: number;
    durationMs?: number;
    timelineStartMs?: number;
    layerOrder?: number;
    chromaKey?: {
      enabled?: boolean;
      color?: string;
      tolerance?: number;
    };
    leftPct?: number;
    topPct?: number;
    widthPct?: number;
    heightPct?: number;
    rotation?: number;
    flipH?: boolean;
    flipV?: boolean;
    motionPath?: MotionKeyframeBackend[];
    oscillation?: OscillationEffectBackend;
  } & SceneClipTimingMetadata;
}

export interface SendVideoToWindowSceneAction extends SceneActionBase {
  type: 'sendVideoToWindow';
  payload: {
    videoAssetId?: string;
    videoUrl?: string;
    loop?: boolean;
    loopSegmentEnabled?: boolean;
    loopSegmentStartMs?: number;
    loopSegmentEndMs?: number;
    playIntroOncePerSceneExecution?: boolean;
    muted?: boolean;
    opacity?: number;
    durationMs?: number;
    timelineStartMs?: number;
    layerOrder?: number;
    chromaKey?: {
      enabled?: boolean;
      color?: string;
      tolerance?: number;
    };
    leftPct?: number;
    topPct?: number;
    widthPct?: number;
    heightPct?: number;
    rotation?: number;
    flipH?: boolean;
    flipV?: boolean;
    motionPath?: MotionKeyframeBackend[];
    oscillation?: OscillationEffectBackend;
  } & SceneClipTimingMetadata;
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
    durationMs?: number;
    timelineStartMs?: number;
    layerOrder?: number;
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
    rotation?: number;
    flipH?: boolean;
    flipV?: boolean;
    motionPath?: MotionKeyframeBackend[];
    oscillation?: OscillationEffectBackend;
    text?: string;
    title?: string;
    durationMs?: number;
    timelineStartMs?: number;
    richTextDoc?: {
      blocks: Array<{
        segments: Array<{
          text: string;
          bold?: boolean;
          italic?: boolean;
          underline?: boolean;
          fontSizePx?: number;
          color?: string;
          fontFamily?: string;
        }>;
      }>;
    };
    leftPct?: number;
    topPct?: number;
    widthPct?: number;
    heightPct?: number;
    opacity?: number;
    layerOrder?: number;
    fontFamily?: string;
    fontSizePx?: number;
    fontColor?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
    letterSpacingPx?: number;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline';
    backgroundMode?: 'none' | 'rect' | 'capsule';
    backgroundColor?: string;
    backgroundOpacity?: number;
    borderRadiusPx?: number;
    paddingPx?: number;
    voiceConfig?: {
      mode: 'retroBeep' | 'animalese' | 'tomodachi' | 'qwenFormant';
      speed?: number;
      pitchRange?: number;
      tomodachi?: {
        sampleSet?: 'classic' | 'bright' | 'soft';
        consonantDensity?: number;
        humanize?: number;
      };
      qwen?: {
        persona?: 'male' | 'female' | 'child' | 'robot';
        pitchMul?: number;
        speedMs?: number;
        brightness?: number;
        volume?: number;
        jitter?: number;
        transitionMul?: number;
        vowelGlitch?: number;
      };
    };
    voiceTarget?: 'main' | 'projection' | 'both';
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
  | PlayPresetSceneAction
  | StopMusicSceneAction
  | PlaySoundSceneAction
  | SetMusicVolumeSceneAction
  | StopSoundSceneAction
  | SetSoundVolumeSceneAction
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
  'playPreset',
  'stopMusic',
  'playSound',
  'setMusicVolume',
  'stopSound',
  'setSoundVolume',
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
  | 'audio.playPreset'
  | 'audio.stopMusic'
  | 'audio.playSound'
  | 'audio.setMusicVolume'
  | 'audio.stopSound'
  | 'audio.setSoundVolume'
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
  sequence?: number;
  executeAtMs?: number;
  issuedAtOffsetMs: number;
}

export const SCENE_SCHEDULE_VERSION = 1;
export const SCENE_SCHEDULE_LEAD_MS = 300;

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