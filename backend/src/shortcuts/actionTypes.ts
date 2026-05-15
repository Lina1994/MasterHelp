export type ShortcutScope = 'global' | 'campaign';

export type ShortcutMode = 'button' | 'toggle' | 'temporary';

export type TimeOfDayMoment = 'dawn' | 'morning' | 'afternoon' | 'night' | 'midnight';

export type ShortcutWindowTargetKind = 'main' | 'projection' | 'skyline' | 'custom' | 'instance';

export interface ShortcutWindowTarget {
  kind: ShortcutWindowTargetKind;
  windowId?: string;
  windowType?: string;
}

/**
 * Rule for determining when a shortcut with this action should be considered "active".
 * - 'never': this action never makes the shortcut active
 * - 'temporary': automatically activate for the action duration (e.g., SFX playback)
 * - 'when:<field>=<value>': activate only if payload field matches value (e.g., 'when:status=playing')
 */
export type ActiveStateRule = 'never' | 'temporary' | `when:${string}`;

export interface ShortcutActionBase {
  kind: ShortcutActionKind;
  delayMs?: number;
  targetWindow?: ShortcutWindowTarget;
  activeStateRule?: ActiveStateRule | null;
}

export interface ToggleStateAction extends ShortcutActionBase {
  kind: 'toggleState';
  payload?: Record<string, never>;
}

export interface PlaySoundEffectAction extends ShortcutActionBase {
  kind: 'playSoundEffect';
  payload: {
    effectId: string;
    volume?: number;
    loopMode?: 'once' | 'continuous';
    uniquePerEffect?: boolean;
  };
}

export interface PlaySongAction extends ShortcutActionBase {
  kind: 'audio.playSong';
  payload: {
    songId: string;
    loop?: boolean;
    volume?: number;
  };
}

export interface AudioSimpleAction extends ShortcutActionBase {
  kind: 'audio.pause' | 'audio.resume' | 'audio.stop';
  payload?: Record<string, never>;
}

export interface AudioVolumeAction extends ShortcutActionBase {
  kind: 'audio.setVolume' | 'audio.adjustVolume';
  payload: {
    value: number;
  };
}

export interface AudioMuteAction extends ShortcutActionBase {
  kind: 'audio.setMute';
  payload: {
    muted: boolean;
  };
}

export interface PlayPlaylistAction extends ShortcutActionBase {
  kind: 'audio.playPlaylist';
  payload: {
    playlistId: string;
  };
}

export interface PlayPresetEffectsAction extends ShortcutActionBase {
  kind: 'audio.playPresetEffects';
  payload: {
    presetId: string;
  };
}

export interface DayShiftAction extends ShortcutActionBase {
  kind: 'time.advanceDay' | 'time.rewindDay';
  payload?: {
    amount?: number;
  };
}

export interface TimeMomentAction extends ShortcutActionBase {
  kind: 'time.setMoment';
  payload: {
    value: TimeOfDayMoment;
  };
}

export interface TimeStepAction extends ShortcutActionBase {
  kind: 'time.advanceMoment' | 'time.rewindMoment';
  payload?: Record<string, never>;
}

export interface CombatSimpleAction extends ShortcutActionBase {
  kind: 'combat.start' | 'combat.escape' | 'combat.end' | 'combat.nextTurn' | 'combat.previousTurn';
  payload?: Record<string, never>;
}

export interface WindowImageAction extends ShortcutActionBase {
  kind: 'window.showCharacterImage' | 'window.showNpcImage' | 'window.showMonsterImage';
  payload: {
    entityId: string;
  };
}

export interface WindowFilterAction extends ShortcutActionBase {
  kind: 'window.applyFilter';
  payload: {
    filter: string;
    intensity?: number;
    color?: string;
  };
}

export interface WindowClearFilterAction extends ShortcutActionBase {
  kind: 'window.clearFilter';
  payload?: Record<string, never>;
}

export interface WindowShowTextAction extends ShortcutActionBase {
  kind: 'window.showText';
  payload: {
    text: string;
    title?: string;
    durationMs?: number;
  };
}

export interface WindowSetActiveMapAction extends ShortcutActionBase {
  kind: 'window.setActiveMap';
  payload: {
    mapId: string;
  };
}

export interface ConfigLanguageAction extends ShortcutActionBase {
  kind: 'config.setLanguage';
  payload: {
    language: string;
  };
}

export interface ConfigThemeAction extends ShortcutActionBase {
  kind: 'config.setTheme';
  payload: {
    theme: string;
  };
}

export interface ConfigFontScaleAction extends ShortcutActionBase {
  kind: 'config.setFontScale';
  payload: {
    scale: number;
  };
}

export interface ConfigUpdateSettingsAction extends ShortcutActionBase {
  kind: 'config.updateSettings';
  payload: {
    key: string;
    value: unknown;
  };
}

export interface DelayAction extends ShortcutActionBase {
  kind: 'delay.wait';
  payload: {
    durationMs: number;
  };
}

export interface RunSceneAction extends ShortcutActionBase {
  kind: 'runScene';
  payload: {
    sceneId: string;
  };
}

export type ShortcutActionDefinition =
  | ToggleStateAction
  | PlaySoundEffectAction
  | PlaySongAction
  | AudioSimpleAction
  | AudioVolumeAction
  | AudioMuteAction
  | PlayPlaylistAction
  | PlayPresetEffectsAction
  | DayShiftAction
  | TimeMomentAction
  | TimeStepAction
  | CombatSimpleAction
  | WindowImageAction
  | WindowFilterAction
  | WindowClearFilterAction
  | WindowShowTextAction
  | WindowSetActiveMapAction
  | ConfigLanguageAction
  | ConfigThemeAction
  | ConfigFontScaleAction
  | ConfigUpdateSettingsAction
  | DelayAction
  | RunSceneAction;

export type ShortcutActionKind = ShortcutActionDefinition['kind'];

export const SHORTCUT_ACTION_KINDS: readonly ShortcutActionKind[] = [
  'toggleState',
  'playSoundEffect',
  'audio.playSong',
  'audio.pause',
  'audio.resume',
  'audio.stop',
  'audio.setVolume',
  'audio.adjustVolume',
  'audio.setMute',
  'audio.playPlaylist',
  'audio.playPresetEffects',
  'time.advanceDay',
  'time.rewindDay',
  'time.setMoment',
  'time.advanceMoment',
  'time.rewindMoment',
  'combat.start',
  'combat.escape',
  'combat.end',
  'combat.nextTurn',
  'combat.previousTurn',
  'window.showCharacterImage',
  'window.showNpcImage',
  'window.showMonsterImage',
  'window.applyFilter',
  'window.clearFilter',
  'window.showText',
  'window.setActiveMap',
  'config.setLanguage',
  'config.setTheme',
  'config.setFontScale',
  'config.updateSettings',
  'delay.wait',
  'runScene',
];

export const SHORTCUT_WINDOW_TARGET_KINDS: readonly ShortcutWindowTargetKind[] = [
  'main',
  'projection',
  'skyline',
  'custom',
  'instance',
];

export const SHORTCUT_SCHEMA_VERSION = 2;
