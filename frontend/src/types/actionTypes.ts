export type ShortcutScope = 'global' | 'campaign';

export type ShortcutMode = 'button' | 'toggle' | 'temporary';

export type TimeOfDayMoment = 'dawn' | 'morning' | 'afternoon' | 'night' | 'midnight';

export type ShortcutWindowTargetKind = 'main' | 'projection' | 'skyline' | 'custom' | 'instance';

export interface ShortcutWindowTarget {
  kind: ShortcutWindowTargetKind;
  windowId?: string;
  windowType?: string;
}

export interface ShortcutActionBase {
  kind: ShortcutActionKind;
  delayMs?: number;
  targetWindow?: ShortcutWindowTarget;
  payload?: Record<string, unknown>;
  // Legacy compatibility while old payloads are still stored with `config`.
  config?: Record<string, unknown>;
}

export type ShortcutActionKind =
  | 'toggleState'
  | 'playSoundEffect'
  | 'audio.playSong'
  | 'audio.pause'
  | 'audio.resume'
  | 'audio.stop'
  | 'audio.setVolume'
  | 'audio.adjustVolume'
  | 'audio.setMute'
  | 'audio.playPlaylist'
  | 'audio.playPresetEffects'
  | 'time.advanceDay'
  | 'time.rewindDay'
  | 'time.setMoment'
  | 'time.advanceMoment'
  | 'time.rewindMoment'
  | 'combat.start'
  | 'combat.escape'
  | 'combat.end'
  | 'combat.nextTurn'
  | 'combat.previousTurn'
  | 'window.showCharacterImage'
  | 'window.showNpcImage'
  | 'window.showMonsterImage'
  | 'window.applyFilter'
  | 'window.clearFilter'
  | 'window.showText'
  | 'window.setActiveMap'
  | 'config.setLanguage'
  | 'config.setTheme'
  | 'config.setFontScale'
  | 'config.updateSettings'
  | 'delay.wait';

export type ShortcutActionDefinition = ShortcutActionBase;

export const SHORTCUT_ACTION_KIND_OPTIONS: Array<{ value: ShortcutActionKind; label: string }> = [
  { value: 'toggleState', label: 'Toggle visual' },
  { value: 'playSoundEffect', label: 'Play SFX' },
  { value: 'audio.playSong', label: 'Play song' },
  { value: 'audio.pause', label: 'Pause audio' },
  { value: 'audio.resume', label: 'Resume audio' },
  { value: 'audio.stop', label: 'Stop audio' },
  { value: 'audio.setVolume', label: 'Set volume' },
  { value: 'audio.adjustVolume', label: 'Adjust volume' },
  { value: 'audio.setMute', label: 'Set mute' },
  { value: 'audio.playPlaylist', label: 'Play playlist' },
  { value: 'audio.playPresetEffects', label: 'Play SFX preset' },
  { value: 'time.advanceDay', label: 'Advance day' },
  { value: 'time.rewindDay', label: 'Rewind day' },
  { value: 'time.setMoment', label: 'Set moment' },
  { value: 'time.advanceMoment', label: 'Advance moment' },
  { value: 'time.rewindMoment', label: 'Rewind moment' },
  { value: 'combat.start', label: 'Start combat' },
  { value: 'combat.escape', label: 'Escape combat' },
  { value: 'combat.end', label: 'End combat' },
  { value: 'combat.nextTurn', label: 'Next turn' },
  { value: 'combat.previousTurn', label: 'Previous turn' },
  { value: 'window.showCharacterImage', label: 'Show character image' },
  { value: 'window.showNpcImage', label: 'Show NPC image' },
  { value: 'window.showMonsterImage', label: 'Show monster image' },
  { value: 'window.applyFilter', label: 'Apply filter' },
  { value: 'window.clearFilter', label: 'Clear filter' },
  { value: 'window.showText', label: 'Show text' },
  { value: 'window.setActiveMap', label: 'Set active map' },
  { value: 'config.setLanguage', label: 'Set language' },
  { value: 'config.setTheme', label: 'Set theme' },
  { value: 'config.setFontScale', label: 'Set font scale' },
  { value: 'config.updateSettings', label: 'Update app setting' },
  { value: 'delay.wait', label: 'Delay / wait' },
];

export const SHORTCUT_WINDOW_TARGET_KIND_OPTIONS: Array<{ value: ShortcutWindowTargetKind; label: string }> = [
  { value: 'main', label: 'Main window' },
  { value: 'projection', label: 'Projection window' },
  { value: 'skyline', label: 'Skyline window' },
  { value: 'custom', label: 'Custom window type' },
  { value: 'instance', label: 'Window instance ID' },
];

export const SHORTCUT_SCHEMA_VERSION = 2;
