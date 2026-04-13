export type ShortcutMode = 'button' | 'toggle' | 'temporary';
export type ShortcutActionKind = 'toggleState' | 'playSoundEffect';

export interface ShortcutActionDefinition {
  kind: ShortcutActionKind;
  config: Record<string, unknown>;
}

export interface ShortcutItem {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  hotkey?: string | null;
  mode: ShortcutMode;
  temporaryDurationMs?: number | null;
  isActive: boolean;
  activeUntil?: string | null;
  activeColor?: string | null;
  inactiveColor?: string | null;
  showOnHome: boolean;
  showInSidebarPanel: boolean;
  showInHotbar: boolean;
  sortOrder: number;
  sidebarPanelOrder: number;
  hotbarOrder: number;
  actions: ShortcutActionDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface ShortcutShellConfig {
  showHomeSection: boolean;
  showSidebarPanel: boolean;
  showHotbar: boolean;
  sidebarPanelColumns: 1 | 2 | 3;
}

export interface ShortcutPayload {
  name: string;
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  hotkey?: string | null;
  mode?: ShortcutMode;
  temporaryDurationMs?: number | null;
  activeColor?: string | null;
  inactiveColor?: string | null;
  showOnHome?: boolean;
  showInSidebarPanel?: boolean;
  showInHotbar?: boolean;
  sortOrder?: number;
  sidebarPanelOrder?: number;
  hotbarOrder?: number;
  actions: ShortcutActionDefinition[];
}

export interface SoundEffectOption {
  id: string;
  name: string;
  category?: string | null;
}

export interface HotkeyKeyboardLikeEvent {
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  key: string;
}

export const DEFAULT_SHORTCUTS_CONFIG: ShortcutShellConfig = {
  showHomeSection: true,
  showSidebarPanel: true,
  showHotbar: false,
  sidebarPanelColumns: 3,
};

export function parseShortcutsConfig(raw: string | null | undefined): ShortcutShellConfig {
  if (!raw) return DEFAULT_SHORTCUTS_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    const columns = parsed?.sidebarPanelColumns;
    return {
      showHomeSection: parsed?.showHomeSection !== false,
      showSidebarPanel: parsed?.showSidebarPanel !== false,
      showHotbar: parsed?.showHotbar === true,
      sidebarPanelColumns: columns === 1 || columns === 2 || columns === 3 ? columns : 3,
    };
  } catch {
    return DEFAULT_SHORTCUTS_CONFIG;
  }
}

export function normalizeHotkey(value: string): string {
  return value
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .sort((left, right) => {
      const order = ['ctrl', 'alt', 'shift', 'meta'];
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    })
    .join('+');
}

/**
 * Builds a normalized hotkey string from a keyboard event-like object.
 */
export function hotkeyFromKeyboardEvent(event: HotkeyKeyboardLikeEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (event.metaKey) parts.push('meta');

  const key = (event.key || '').toLowerCase();
  const isModifier = key === 'control' || key === 'shift' || key === 'alt' || key === 'meta';
  if (!isModifier && key) {
    parts.push(key);
  }

  return normalizeHotkey(parts.join('+'));
}