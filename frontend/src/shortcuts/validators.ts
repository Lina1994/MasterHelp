import type { ShortcutActionDefinition, ShortcutItem } from '../types/shortcuts';

export const getActionPayload = (action: ShortcutActionDefinition): Record<string, unknown> => {
  return (action.payload ?? action.config ?? {}) as Record<string, unknown>;
};

export const validateActionForEditor = (action: ShortcutActionDefinition): string | null => {
  const payload = getActionPayload(action);

  switch (action.kind) {
    case 'playSoundEffect':
      return typeof payload.effectId === 'string' && payload.effectId ? null : 'playSoundEffect requiere effectId';
    case 'audio.playSong':
      return typeof payload.songId === 'string' && payload.songId ? null : 'audio.playSong requiere songId';
    case 'audio.playPlaylist':
      return typeof payload.playlistId === 'string' && payload.playlistId ? null : 'audio.playPlaylist requiere playlistId';
    case 'audio.playPresetEffects':
      return typeof payload.presetId === 'string' && payload.presetId ? null : 'audio.playPresetEffects requiere presetId';
    case 'audio.setVolume':
    case 'audio.adjustVolume':
      return typeof payload.value === 'number' ? null : `${action.kind} requiere value numérico`;
    case 'audio.setMute':
      return typeof payload.muted === 'boolean' ? null : 'audio.setMute requiere muted boolean';
    case 'time.setMoment':
      return typeof payload.value === 'string' && payload.value ? null : 'time.setMoment requiere value';
    case 'config.setLanguage':
      return typeof payload.language === 'string' && payload.language ? null : 'config.setLanguage requiere language';
    case 'config.setTheme':
      return typeof payload.theme === 'string' && payload.theme ? null : 'config.setTheme requiere theme';
    case 'config.setFontScale':
      return typeof payload.scale === 'number' ? null : 'config.setFontScale requiere scale numérico';
    case 'config.updateSettings':
      return typeof payload.key === 'string' && payload.key ? null : 'config.updateSettings requiere key';
    case 'window.showText':
      return typeof payload.text === 'string' && payload.text ? null : 'window.showText requiere text';
    case 'window.applyFilter':
      return typeof payload.filter === 'string' && payload.filter ? null : 'window.applyFilter requiere filter';
    case 'window.showCharacterImage':
    case 'window.showNpcImage':
    case 'window.showMonsterImage':
      return typeof payload.entityId === 'string' && payload.entityId ? null : `${action.kind} requiere entityId`;
    case 'window.setActiveMap':
      return typeof payload.mapId === 'string' && payload.mapId ? null : 'window.setActiveMap requiere mapId';
    case 'delay.wait':
      return typeof payload.durationMs === 'number' && payload.durationMs >= 0 ? null : 'delay.wait requiere durationMs >= 0';
    default:
      return null;
  }
};

export const findHotkeyConflict = (
  shortcuts: ShortcutItem[],
  candidateHotkey: string | null | undefined,
  editingId?: string,
  scope: 'global' | 'campaign' = 'global',
  campaignId?: string | null,
): ShortcutItem | null => {
  if (!candidateHotkey) return null;
  const normalizedCandidate = candidateHotkey.trim().toLowerCase();

  const relevantShortcuts = shortcuts.filter((shortcut) => {
    if (editingId && shortcut.id === editingId) return false;
    if (scope === 'campaign') {
      return shortcut.scope === 'global' || (shortcut.scope === 'campaign' && shortcut.campaignId === (campaignId || null));
    }
    // Global shortcut conflicts with any existing binding because global shortcuts are active in every campaign.
    return true;
  });

  return relevantShortcuts.find((shortcut) => {
    return (shortcut.hotkey || '').trim().toLowerCase() === normalizedCandidate;
  }) || null;
};
