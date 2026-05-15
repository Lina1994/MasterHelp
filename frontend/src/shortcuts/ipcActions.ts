import type { ShortcutActionDefinition, ShortcutWindowTarget } from '../types/actionTypes';
import type { SceneRuntimeCommand, SceneWindowTarget } from '../types/scenes';

export type ShortcutRuntimeWindow = {
  id: string;
  kind: string;
  title: string;
  campaignId: string | null;
  webContentsId: number;
  createdAt: string;
};

const resolveElectronTarget = (target?: ShortcutWindowTarget | SceneWindowTarget): string | null => {
  if (!target) return null;
  if (target.kind === 'instance') return target.windowId || null;
  if (target.kind === 'custom') return target.windowType || null;
  return target.kind;
};

const emitBrowserShortcutEvent = (action: ShortcutActionDefinition): void => {
  try {
    window.dispatchEvent(new CustomEvent('shortcut:action', { detail: action }));
  } catch {
    // no-op in non-browser or blocked contexts
  }
};

const emitBrowserSceneWindowEvent = (command: SceneRuntimeCommand): void => {
  try {
    window.dispatchEvent(new CustomEvent('scene:window-command', { detail: command }));
  } catch {
    // no-op in non-browser or blocked contexts
  }
};

/**
 * Dispatches window-focused actions through Electron IPC when available,
 * with browser fallback events for web mode.
 */
export const dispatchWindowShortcutAction = async (
  action: ShortcutActionDefinition,
  campaignId?: string | null,
): Promise<void> => {
  const payload = {
    action,
    campaignId: campaignId || null,
    target: resolveElectronTarget(action.targetWindow),
  };

  try {
    const electron = (window as any)?.electronAPI;
    if (electron?.dispatchShortcutWindowAction) {
      await electron.dispatchShortcutWindowAction(payload);
      return;
    }

    if (action.kind === 'window.setActiveMap' || action.kind === 'window.showText' || action.kind === 'window.applyFilter' || action.kind === 'window.clearFilter') {
      electron?.projectionPoke?.({ type: 'shortcut-window-action', ...payload });
    }
  } catch {
    // fallback to browser event
  }

  emitBrowserShortcutEvent(action);
};

/**
 * Returns available windows for shortcut targeting when Electron bridge is present.
 */
export const dispatchSceneWindowCommand = async (
  command: SceneRuntimeCommand,
  campaignId?: string | null,
): Promise<void> => {
  const payload = {
    action: {
      kind: 'scene.runtime',
      payload: { command },
    },
    campaignId: campaignId || null,
    target: resolveElectronTarget(command.targetWindow),
  };

  try {
    const electron = (window as any)?.electronAPI;
    if (electron?.dispatchShortcutWindowAction) {
      await electron.dispatchShortcutWindowAction(payload);
      return;
    }
  } catch {
    // fallback to browser event
  }

  emitBrowserSceneWindowEvent(command);
};

export const listShortcutWindows = async (): Promise<ShortcutRuntimeWindow[]> => {
  try {
    const electron = (window as any)?.electronAPI;
    if (electron?.listShortcutWindows) {
      const rows = await electron.listShortcutWindows();
      return Array.isArray(rows) ? rows : [];
    }
  } catch {
    // no-op
  }

  return [{
    id: 'main',
    kind: 'main',
    title: 'Main window',
    campaignId: null,
    webContentsId: 0,
    createdAt: new Date().toISOString(),
  }];
};
