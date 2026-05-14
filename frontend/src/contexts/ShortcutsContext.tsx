import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import API_BASE_URL, { api } from '../apiBase';
import {
  createShortcut,
  deleteShortcut,
  executeShortcut as executeShortcutApi,
  listShortcutSoundEffects,
  listShortcuts,
  updateShortcut,
} from '../api/shortcuts';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useSfxPlayer } from '../components/player/SfxPlayerContext';
import { buildEffectStreamUrl } from '../utils/soundEffects';
import {
  DEFAULT_SHORTCUTS_CONFIG,
  DEFAULT_SHORTCUT_PANEL_ID,
  hotkeyFromKeyboardEvent,
  normalizeHotkey,
  parseShortcutsConfig,
  type ShortcutItem,
  type ShortcutPanelModifierKey,
  type ShortcutPayload,
  type ShortcutShellConfig,
  type SoundEffectOption,
} from '../types/shortcuts';
import { runShortcutActions, runShortcutDraftActions, type ShortcutActionExecutionResult } from '../shortcuts/ShortcutRunner';

interface ShortcutsContextValue {
  shortcuts: ShortcutItem[];
  homeShortcuts: ShortcutItem[];
  sidebarPanelShortcuts: ShortcutItem[];
  hotbarShortcuts: ShortcutItem[];
  activePanelId: string;
  activePanelName: string;
  config: ShortcutShellConfig;
  loaded: boolean;
  soundEffects: SoundEffectOption[];
  saveConfig: (config: ShortcutShellConfig) => Promise<void>;
  updateShortcutPanelMap: (shortcutId: string, panelIds: string[]) => Promise<void>;
  refreshShortcuts: () => Promise<void>;
  createShortcut: (payload: ShortcutPayload) => Promise<ShortcutItem>;
  updateShortcut: (id: string, payload: Partial<ShortcutPayload>) => Promise<ShortcutItem>;
  deleteShortcut: (id: string) => Promise<void>;
  executeShortcut: (shortcut: ShortcutItem) => Promise<void>;
  testShortcutDraft: (payload: ShortcutPayload) => Promise<ShortcutActionExecutionResult[]>;
}

const ShortcutsContext = createContext<ShortcutsContextValue>({
  shortcuts: [],
  homeShortcuts: [],
  sidebarPanelShortcuts: [],
  hotbarShortcuts: [],
  activePanelId: DEFAULT_SHORTCUT_PANEL_ID,
  activePanelName: 'Base',
  config: DEFAULT_SHORTCUTS_CONFIG,
  loaded: false,
  soundEffects: [],
  saveConfig: async () => {},
  updateShortcutPanelMap: async () => {},
  refreshShortcuts: async () => {},
  createShortcut: async () => ({ ...({} as ShortcutItem) }),
  updateShortcut: async () => ({ ...({} as ShortcutItem) }),
  deleteShortcut: async () => {},
  executeShortcut: async () => {},
  testShortcutDraft: async () => [],
});

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tagName = element.tagName;
  return element.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

const getModifierKey = (eventKey: string): ShortcutPanelModifierKey | null => {
  const key = eventKey.toLowerCase();
  if (key === 'control') return 'ctrl';
  if (key === 'alt') return 'alt';
  if (key === 'shift') return 'shift';
  if (key === 'meta') return 'meta';
  return null;
};

const resolveDefaultPanel = (config: ShortcutShellConfig): string => {
  const panelIds = new Set(config.panels.map((panel) => panel.id));
  if (panelIds.has(config.defaultPanelId)) return config.defaultPanelId;
  if (panelIds.has(DEFAULT_SHORTCUT_PANEL_ID)) return DEFAULT_SHORTCUT_PANEL_ID;
  return config.panels[0]?.id || DEFAULT_SHORTCUT_PANEL_ID;
};

const getShortcutOrder = (shortcut: ShortcutItem): number => {
  const orders = [shortcut.hotbarOrder, shortcut.sidebarPanelOrder, shortcut.sortOrder]
    .filter((value) => typeof value === 'number') as number[];
  return orders.length > 0 ? Math.min(...orders) : 0;
};

const buildNextPanelOrder = (
  previous: Record<string, string[]>,
  shortcutId: string,
  panelId: string | null,
): Record<string, string[]> => {
  const next: Record<string, string[]> = {};
  Object.entries(previous).forEach(([key, value]) => {
    const filtered = value.filter((entry) => entry !== shortcutId);
    if (filtered.length > 0) next[key] = filtered;
  });
  if (panelId) {
    next[panelId] = [...(next[panelId] || []), shortcutId];
  }
  return next;
};

/**
 * Provider responsible for shortcut persistence, runtime execution and shell placements.
 */
export const ShortcutsProvider = ({ children }: { children: ReactNode }) => {
  const { activeCampaign } = useActiveCampaign();
  const { playSfx } = useSfxPlayer();
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [soundEffects, setSoundEffects] = useState<SoundEffectOption[]>([]);
  const [config, setConfig] = useState<ShortcutShellConfig>(DEFAULT_SHORTCUTS_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [activePanelId, setActivePanelId] = useState<string>(DEFAULT_SHORTCUT_PANEL_ID);
  const didApplyInitialHotbarAutoEnable = useRef(false);
  const didApplyLegacyPanelMap = useRef(false);
  const heldModifierOrderRef = useRef<ShortcutPanelModifierKey[]>([]);

  const refreshShortcuts = useCallback(async () => {
    const data = await listShortcuts({ campaignId: activeCampaign?.id });
    setShortcuts(data);
  }, [activeCampaign?.id]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoaded(true);
      return;
    }
    Promise.all([
      axios.get(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
      listShortcuts({ campaignId: activeCampaign?.id }),
    ])
      .then(([userResponse, shortcutsResponse]) => {
        if (cancelled) return;
        const parsedConfig = parseShortcutsConfig(userResponse.data?.shortcutsConfig);
        setConfig(parsedConfig);
        setActivePanelId(resolveDefaultPanel(parsedConfig));
        setShortcuts(shortcutsResponse);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [activeCampaign?.id]);

  useEffect(() => {
    let cancelled = false;
    listShortcutSoundEffects(activeCampaign?.id)
      .then((items) => {
        if (!cancelled) setSoundEffects(items);
      })
      .catch(() => {
        if (!cancelled) setSoundEffects([]);
      });
    return () => { cancelled = true; };
  }, [activeCampaign?.id]);

  const persistConfig = useCallback(async (nextConfig: ShortcutShellConfig) => {
    setConfig(nextConfig);
    const token = localStorage.getItem('access_token');
    if (!token) return;
    await axios.patch(
      `${API_BASE_URL}/users/me/preferences`,
      { shortcutsConfig: JSON.stringify(nextConfig) },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }, []);

  const saveConfig = useCallback(async (nextConfig: ShortcutShellConfig) => {
    const normalized = parseShortcutsConfig(JSON.stringify(nextConfig));
    setActivePanelId((prev) => {
      const panelIds = new Set(normalized.panels.map((panel) => panel.id));
      if (panelIds.has(prev)) return prev;
      return resolveDefaultPanel(normalized);
    });
    await persistConfig(normalized);
  }, [persistConfig]);

  const enableHotbarShell = useCallback(async () => {
    if (config.showHotbar) return;
    await saveConfig({ ...config, showHotbar: true });
  }, [config, saveConfig]);

  const updateShortcutPanelMap = useCallback(async (shortcutId: string, panelIds: string[]) => {
    const validPanels = new Set(config.panels.map((panel) => panel.id));
    const sanitized = Array.from(new Set(panelIds.filter((panelId) => validPanels.has(panelId))));
    const selectedPanelId = sanitized[0] || null;
    const nextMap = { ...config.shortcutPanelMap };
    if (!selectedPanelId) {
      delete nextMap[shortcutId];
    } else {
      nextMap[shortcutId] = [selectedPanelId];
    }
    await saveConfig({
      ...config,
      shortcutPanelMap: nextMap,
      panelShortcutOrder: buildNextPanelOrder(config.panelShortcutOrder, shortcutId, selectedPanelId),
    });
  }, [config, saveConfig]);

  const createShortcutItem = useCallback(async (payload: ShortcutPayload) => {
    const created = await createShortcut(payload);
    setShortcuts((prev) => [...prev].concat(created).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)));
    if ((payload.showInHotbar ?? created.showInHotbar) === true) {
      void enableHotbarShell();
    }
    return created;
  }, [enableHotbarShell]);

  const updateShortcutItem = useCallback(async (id: string, payload: Partial<ShortcutPayload>) => {
    const updated = await updateShortcut(id, payload);
    setShortcuts((prev) => prev.map((shortcut) => (shortcut.id === id ? updated : shortcut)));
    if ((payload.showInHotbar ?? updated.showInHotbar) === true) {
      void enableHotbarShell();
    }
    return updated;
  }, [enableHotbarShell]);

  const deleteShortcutItem = useCallback(async (id: string) => {
    await deleteShortcut(id);
    setShortcuts((prev) => prev.filter((shortcut) => shortcut.id !== id));
    if (config.shortcutPanelMap[id] || Object.values(config.panelShortcutOrder).some((entries) => entries.includes(id))) {
      const nextMap = { ...config.shortcutPanelMap };
      delete nextMap[id];
      void saveConfig({
        ...config,
        shortcutPanelMap: nextMap,
        panelShortcutOrder: buildNextPanelOrder(config.panelShortcutOrder, id, null),
      });
    }
  }, [config, saveConfig]);

  const runClientActions = useCallback(async (shortcut: ShortcutItem) => {
    return runShortcutActions(shortcut, {
      campaignId: activeCampaign?.id,
      shortcutName: shortcut.name,
      soundEffects,
      playSfx,
      buildEffectUrl: (effectId, campaignId) => buildEffectStreamUrl(api.defaults.baseURL, effectId, campaignId),
    });
  }, [activeCampaign?.id, playSfx, soundEffects]);

  const executeShortcut = useCallback(async (shortcut: ShortcutItem) => {
    const updated = await executeShortcutApi(shortcut.id);
    setShortcuts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    await runClientActions(updated);
    if (updated.mode === 'temporary' && updated.activeUntil) {
      const remaining = new Date(updated.activeUntil).getTime() - Date.now();
      if (remaining > 0) {
        window.setTimeout(() => {
          setShortcuts((prev) => prev.map((item) => (item.id === updated.id ? { ...item, isActive: false, activeUntil: null } : item)));
        }, remaining);
      }
    }
  }, [runClientActions]);

  const testShortcutDraft = useCallback(async (payload: ShortcutPayload) => {
    return runShortcutDraftActions(payload.actions, {
      campaignId: activeCampaign?.id,
      shortcutName: payload.name,
      soundEffects,
      playSfx,
      buildEffectUrl: (effectId, campaignId) => buildEffectStreamUrl(api.defaults.baseURL, effectId, campaignId),
    });
  }, [activeCampaign?.id, playSfx, soundEffects]);

  const getShortcutPanelIds = useCallback((shortcut: ShortcutItem): string[] => {
    const mapped = config.shortcutPanelMap[shortcut.id];
    if (Array.isArray(mapped) && mapped.length > 0) return [mapped[0]];
    if (shortcut.showInHotbar || shortcut.showInSidebarPanel) return [DEFAULT_SHORTCUT_PANEL_ID];
    return [];
  }, [config.shortcutPanelMap]);

  const recomputeActivePanel = useCallback(() => {
    for (let index = heldModifierOrderRef.current.length - 1; index >= 0; index -= 1) {
      const modifier = heldModifierOrderRef.current[index];
      const panelId = config.modifierPanelBindings[modifier];
      if (panelId && config.panels.some((panel) => panel.id === panelId)) {
        setActivePanelId(panelId);
        return;
      }
    }
    setActivePanelId(resolveDefaultPanel(config));
  }, [config]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const modifier = getModifierKey(event.key);
      if (modifier) {
        if (!heldModifierOrderRef.current.includes(modifier)) {
          heldModifierOrderRef.current.push(modifier);
          recomputeActivePanel();
        }
        if (config.modifierPanelBindings[modifier]) {
          event.preventDefault();
          return;
        }
      }

      const pressed = hotkeyFromKeyboardEvent(event);
      if (!pressed) return;
      const match = shortcuts.find((shortcut) => shortcut.hotkey && normalizeHotkey(shortcut.hotkey) === pressed);
      if (!match) return;
      event.preventDefault();
      void executeShortcut(match);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const modifier = getModifierKey(event.key);
      if (!modifier) return;
      const next = heldModifierOrderRef.current.filter((entry) => entry !== modifier);
      if (next.length !== heldModifierOrderRef.current.length) {
        heldModifierOrderRef.current = next;
        recomputeActivePanel();
      }
    };

    const handleWindowBlur = () => {
      heldModifierOrderRef.current = [];
      setActivePanelId(resolveDefaultPanel(config));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [config, executeShortcut, recomputeActivePanel, shortcuts]);

  const homeShortcuts = useMemo(
    () => [...shortcuts].filter((shortcut) => shortcut.showOnHome).sort((left, right) => left.sortOrder - right.sortOrder),
    [shortcuts],
  );

  const panelShortcuts = useMemo(() => {
    const assigned = [...shortcuts].filter((shortcut) => getShortcutPanelIds(shortcut)[0] === activePanelId);
    const byId = new Map(assigned.map((shortcut) => [shortcut.id, shortcut]));
    const orderedIds = config.panelShortcutOrder[activePanelId] || [];
    const orderedShortcuts = orderedIds
      .map((shortcutId) => byId.get(shortcutId))
      .filter(Boolean) as ShortcutItem[];
    const remaining = assigned
      .filter((shortcut) => !orderedIds.includes(shortcut.id))
      .sort((left, right) => getShortcutOrder(left) - getShortcutOrder(right) || left.name.localeCompare(right.name));
    return [...orderedShortcuts, ...remaining];
  }, [activePanelId, config.panelShortcutOrder, getShortcutPanelIds, shortcuts]);

  const sidebarPanelShortcuts = useMemo(() => panelShortcuts, [panelShortcuts]);
  const hotbarShortcuts = useMemo(() => panelShortcuts, [panelShortcuts]);

  const activePanelName = useMemo(() => {
    const match = config.panels.find((panel) => panel.id === activePanelId);
    return match?.name || 'Base';
  }, [activePanelId, config.panels]);

  useEffect(() => {
    if (!loaded || didApplyInitialHotbarAutoEnable.current) return;
    didApplyInitialHotbarAutoEnable.current = true;
    if (shortcuts.some((shortcut) => shortcut.showInHotbar)) {
      void enableHotbarShell();
    }
  }, [enableHotbarShell, loaded, shortcuts]);

  useEffect(() => {
    if (!loaded || didApplyLegacyPanelMap.current) return;
    didApplyLegacyPanelMap.current = true;
    const nextMap = { ...config.shortcutPanelMap };
    const nextPanelOrder = { ...config.panelShortcutOrder };
    let changed = false;
    shortcuts.forEach((shortcut) => {
      if (nextMap[shortcut.id]?.length) return;
      if (shortcut.showInHotbar || shortcut.showInSidebarPanel) {
        nextMap[shortcut.id] = [DEFAULT_SHORTCUT_PANEL_ID];
        nextPanelOrder[DEFAULT_SHORTCUT_PANEL_ID] = [...(nextPanelOrder[DEFAULT_SHORTCUT_PANEL_ID] || []), shortcut.id];
        changed = true;
      }
    });
    if (changed) {
      void saveConfig({ ...config, shortcutPanelMap: nextMap, panelShortcutOrder: nextPanelOrder });
    }
  }, [config, loaded, saveConfig, shortcuts]);

  useEffect(() => {
    setActivePanelId((prev) => {
      const panelIds = new Set(config.panels.map((panel) => panel.id));
      if (panelIds.has(prev)) return prev;
      return resolveDefaultPanel(config);
    });
  }, [config]);

  return (
    <ShortcutsContext.Provider
      value={{
        shortcuts,
        homeShortcuts,
        sidebarPanelShortcuts,
        hotbarShortcuts,
        activePanelId,
        activePanelName,
        config,
        loaded,
        soundEffects,
        saveConfig,
        updateShortcutPanelMap,
        refreshShortcuts,
        createShortcut: createShortcutItem,
        updateShortcut: updateShortcutItem,
        deleteShortcut: deleteShortcutItem,
        executeShortcut,
        testShortcutDraft,
      }}
    >
      {children}
    </ShortcutsContext.Provider>
  );
};

export const useShortcuts = () => useContext(ShortcutsContext);
