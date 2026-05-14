import {
  SHORTCUT_SCHEMA_VERSION,
  type ShortcutActionDefinition,
  type ShortcutMode,
  type ShortcutScope,
} from './actionTypes';

export type { ShortcutActionDefinition, ShortcutMode, ShortcutScope } from './actionTypes';

export interface ShortcutItem {
  id: string;
  scope: ShortcutScope;
  campaignId?: string | null;
  schemaVersion?: number;
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
  panels: ShortcutPanel[];
  defaultPanelId: string;
  modifierPanelBindings: Partial<Record<ShortcutPanelModifierKey, string>>;
  shortcutPanelMap: Record<string, string[]>;
  panelShortcutOrder: Record<string, string[]>;
}

export type ShortcutPanelModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';

export interface ShortcutPanel {
  id: string;
  name: string;
  order: number;
}

export interface ShortcutPayload {
  scope?: ShortcutScope;
  campaignId?: string | null;
  schemaVersion?: number;
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
  panelIds?: string[];
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

export const DEFAULT_SHORTCUT_PANEL_ID = 'base';

export const DEFAULT_SHORTCUTS_CONFIG: ShortcutShellConfig = {
  showHomeSection: true,
  showSidebarPanel: true,
  showHotbar: false,
  sidebarPanelColumns: 3,
  panels: [{ id: DEFAULT_SHORTCUT_PANEL_ID, name: 'Base', order: 0 }],
  defaultPanelId: DEFAULT_SHORTCUT_PANEL_ID,
  modifierPanelBindings: {},
  shortcutPanelMap: {},
  panelShortcutOrder: {},
};

export const DEFAULT_SHORTCUT_SCHEMA_VERSION = SHORTCUT_SCHEMA_VERSION;

const isModifierPanelKey = (value: unknown): value is ShortcutPanelModifierKey => {
  return value === 'ctrl' || value === 'alt' || value === 'shift' || value === 'meta';
};

const normalizePanels = (panels: unknown): ShortcutPanel[] => {
  const rawPanels = Array.isArray(panels) ? panels : [];
  const normalized = rawPanels
    .map((panel, index) => {
      const row = panel as Partial<ShortcutPanel>;
      if (!row?.id || !row?.name) return null;
      return {
        id: String(row.id),
        name: String(row.name),
        order: typeof row.order === 'number' ? row.order : index,
      };
    })
    .filter(Boolean) as ShortcutPanel[];

  if (normalized.length === 0) {
    return [{ id: DEFAULT_SHORTCUT_PANEL_ID, name: 'Base', order: 0 }];
  }

  const hasDefault = normalized.some((panel) => panel.id === DEFAULT_SHORTCUT_PANEL_ID);
  if (!hasDefault) {
    normalized.unshift({ id: DEFAULT_SHORTCUT_PANEL_ID, name: 'Base', order: -1 });
  }

  return normalized.sort((left, right) => left.order - right.order);
};

const normalizeModifierPanelBindings = (
  bindings: unknown,
  panels: ShortcutPanel[],
): Partial<Record<ShortcutPanelModifierKey, string>> => {
  const raw = bindings && typeof bindings === 'object' ? bindings as Record<string, unknown> : {};
  const availableIds = new Set(panels.map((panel) => panel.id));
  const next: Partial<Record<ShortcutPanelModifierKey, string>> = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (!isModifierPanelKey(key)) return;
    if (typeof value !== 'string') return;
    if (!availableIds.has(value)) return;
    next[key] = value;
  });
  return next;
};

const normalizeShortcutPanelMap = (
  map: unknown,
  panels: ShortcutPanel[],
): Record<string, string[]> => {
  const raw = map && typeof map === 'object' ? map as Record<string, unknown> : {};
  const availableIds = new Set(panels.map((panel) => panel.id));
  const next: Record<string, string[]> = {};
  Object.entries(raw).forEach(([shortcutId, value]) => {
    if (!Array.isArray(value)) return;
    const panelIds = value
      .filter((entry): entry is string => typeof entry === 'string')
      .filter((entry) => availableIds.has(entry));
    if (panelIds.length > 0) {
      next[shortcutId] = Array.from(new Set(panelIds));
    }
  });
  return next;
};

const normalizePanelShortcutOrder = (
  orderMap: unknown,
  panels: ShortcutPanel[],
): Record<string, string[]> => {
  const raw = orderMap && typeof orderMap === 'object' ? orderMap as Record<string, unknown> : {};
  const availableIds = new Set(panels.map((panel) => panel.id));
  const next: Record<string, string[]> = {};
  Object.entries(raw).forEach(([panelId, value]) => {
    if (!availableIds.has(panelId)) return;
    if (!Array.isArray(value)) return;
    next[panelId] = Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string')));
  });
  return next;
};

const resolveDefaultPanelId = (candidate: unknown, panels: ShortcutPanel[]): string => {
  const panelIds = new Set(panels.map((panel) => panel.id));
  if (typeof candidate === 'string' && panelIds.has(candidate)) {
    return candidate;
  }
  return panelIds.has(DEFAULT_SHORTCUT_PANEL_ID) ? DEFAULT_SHORTCUT_PANEL_ID : panels[0].id;
};

export function parseShortcutsConfig(raw: string | null | undefined): ShortcutShellConfig {
  if (!raw) return DEFAULT_SHORTCUTS_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    const columns = parsed?.sidebarPanelColumns;
    const panels = normalizePanels(parsed?.panels);
    const defaultPanelId = resolveDefaultPanelId(parsed?.defaultPanelId, panels);
    return {
      showHomeSection: parsed?.showHomeSection !== false,
      showSidebarPanel: parsed?.showSidebarPanel !== false,
      showHotbar: parsed?.showHotbar === true,
      sidebarPanelColumns: columns === 1 || columns === 2 || columns === 3 ? columns : 3,
      panels,
      defaultPanelId,
      modifierPanelBindings: normalizeModifierPanelBindings(parsed?.modifierPanelBindings, panels),
      shortcutPanelMap: normalizeShortcutPanelMap(parsed?.shortcutPanelMap, panels),
      panelShortcutOrder: normalizePanelShortcutOrder(parsed?.panelShortcutOrder, panels),
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