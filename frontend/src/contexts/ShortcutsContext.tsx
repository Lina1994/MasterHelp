import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';
import API_BASE_URL, { api } from '../apiBase';
import { createShortcut, deleteShortcut, executeShortcut as executeShortcutApi, listShortcutSoundEffects, listShortcuts, updateShortcut } from '../api/shortcuts';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useSfxPlayer } from '../components/player/SfxPlayerContext';
import { buildEffectStreamUrl, clamp01 } from '../utils/soundEffects';
import { getAuthHeaders } from '../utils/auth';
import { DEFAULT_SHORTCUTS_CONFIG, hotkeyFromKeyboardEvent, normalizeHotkey, parseShortcutsConfig, type ShortcutItem, type ShortcutPayload, type ShortcutShellConfig, type SoundEffectOption } from '../types/shortcuts';

interface ShortcutsContextValue {
  shortcuts: ShortcutItem[];
  homeShortcuts: ShortcutItem[];
  sidebarPanelShortcuts: ShortcutItem[];
  hotbarShortcuts: ShortcutItem[];
  config: ShortcutShellConfig;
  loaded: boolean;
  soundEffects: SoundEffectOption[];
  saveConfig: (config: ShortcutShellConfig) => Promise<void>;
  refreshShortcuts: () => Promise<void>;
  createShortcut: (payload: ShortcutPayload) => Promise<void>;
  updateShortcut: (id: string, payload: Partial<ShortcutPayload>) => Promise<void>;
  deleteShortcut: (id: string) => Promise<void>;
  executeShortcut: (shortcut: ShortcutItem) => Promise<void>;
}

const ShortcutsContext = createContext<ShortcutsContextValue>({
  shortcuts: [],
  homeShortcuts: [],
  sidebarPanelShortcuts: [],
  hotbarShortcuts: [],
  config: DEFAULT_SHORTCUTS_CONFIG,
  loaded: false,
  soundEffects: [],
  saveConfig: async () => {},
  refreshShortcuts: async () => {},
  createShortcut: async () => {},
  updateShortcut: async () => {},
  deleteShortcut: async () => {},
  executeShortcut: async () => {},
});

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tagName = element.tagName;
  return element.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
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

  const refreshShortcuts = useCallback(async () => {
    const data = await listShortcuts();
    setShortcuts(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoaded(true);
      return;
    }
    Promise.all([
      axios.get(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
      listShortcuts(),
    ])
      .then(([userResponse, shortcutsResponse]) => {
        if (cancelled) return;
        setConfig(parseShortcutsConfig(userResponse.data?.shortcutsConfig));
        setShortcuts(shortcutsResponse);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

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

  const saveConfig = useCallback(async (nextConfig: ShortcutShellConfig) => {
    setConfig(nextConfig);
    const token = localStorage.getItem('access_token');
    await axios.patch(
      `${API_BASE_URL}/users/me/preferences`,
      { shortcutsConfig: JSON.stringify(nextConfig) },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }, []);

  const createShortcutItem = useCallback(async (payload: ShortcutPayload) => {
    const created = await createShortcut(payload);
    setShortcuts((prev) => [...prev, created].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)));
  }, []);

  const updateShortcutItem = useCallback(async (id: string, payload: Partial<ShortcutPayload>) => {
    const updated = await updateShortcut(id, payload);
    setShortcuts((prev) => prev.map((shortcut) => (shortcut.id === id ? updated : shortcut)));
  }, []);

  const deleteShortcutItem = useCallback(async (id: string) => {
    await deleteShortcut(id);
    setShortcuts((prev) => prev.filter((shortcut) => shortcut.id !== id));
  }, []);

  const runClientActions = useCallback(async (shortcut: ShortcutItem) => {
    for (const action of shortcut.actions) {
      if (action.kind === 'playSoundEffect') {
        const effectId = typeof action.config.effectId === 'string' ? action.config.effectId : '';
        if (!effectId) continue;
        const effectName = soundEffects.find((effect) => effect.id === effectId)?.name || shortcut.name;
        await playSfx(
          { effectId, name: effectName },
          async () => {
            const response = await api.get(buildEffectStreamUrl(api.defaults.baseURL, effectId, activeCampaign?.id), {
              headers: getAuthHeaders(),
              responseType: 'blob',
            });
            return URL.createObjectURL(response.data);
          },
          {
            volume: clamp01(Number(action.config.volume ?? 1)),
            loopMode: (action.config.loopMode as any) || 'once',
            uniquePerEffect: Boolean(action.config.uniquePerEffect ?? true),
          },
        );
      }
    }
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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const pressed = hotkeyFromKeyboardEvent(event);
      if (!pressed) return;
      const match = shortcuts.find((shortcut) => shortcut.hotkey && normalizeHotkey(shortcut.hotkey) === pressed);
      if (!match) return;
      event.preventDefault();
      void executeShortcut(match);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [executeShortcut, shortcuts]);

  const homeShortcuts = useMemo(
    () => [...shortcuts].filter((shortcut) => shortcut.showOnHome).sort((left, right) => left.sortOrder - right.sortOrder),
    [shortcuts],
  );
  const sidebarPanelShortcuts = useMemo(
    () => [...shortcuts].filter((shortcut) => shortcut.showInSidebarPanel).sort((left, right) => left.sidebarPanelOrder - right.sidebarPanelOrder),
    [shortcuts],
  );
  const hotbarShortcuts = useMemo(
    () => [...shortcuts].filter((shortcut) => shortcut.showInHotbar).sort((left, right) => left.hotbarOrder - right.hotbarOrder),
    [shortcuts],
  );

  return (
    <ShortcutsContext.Provider
      value={{
        shortcuts,
        homeShortcuts,
        sidebarPanelShortcuts,
        hotbarShortcuts,
        config,
        loaded,
        soundEffects,
        saveConfig,
        refreshShortcuts,
        createShortcut: createShortcutItem,
        updateShortcut: updateShortcutItem,
        deleteShortcut: deleteShortcutItem,
        executeShortcut,
      }}
    >
      {children}
    </ShortcutsContext.Provider>
  );
};

export const useShortcuts = () => useContext(ShortcutsContext);