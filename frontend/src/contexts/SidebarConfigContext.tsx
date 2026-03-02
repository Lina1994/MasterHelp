/**
 * Context that holds the user's sidebar configuration and exposes methods
 * to update it (persisting to the backend).
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiBase';
import {
  type SidebarConfig,
  parseSidebarConfig,
  getDefaultSidebarConfig,
  mergeSidebarConfig,
} from '../constants/sidebarItems';

interface SidebarConfigContextValue {
  /** Merged sidebar items with visibility & order. */
  sidebarItems: { key: string; visible: boolean }[];
  /** Whether the config has been loaded from the backend. */
  loaded: boolean;
  /** Persist a new sidebar config (optimistic update). */
  saveSidebarConfig: (config: SidebarConfig) => Promise<void>;
  /** Reset to defaults. */
  resetSidebarConfig: () => Promise<void>;
}

const SidebarConfigContext = createContext<SidebarConfigContextValue>({
  sidebarItems: getDefaultSidebarConfig().items,
  loaded: false,
  saveSidebarConfig: async () => {},
  resetSidebarConfig: async () => {},
});

/**
 * Hook to consume the sidebar config from anywhere in the component tree.
 *
 * @returns Current sidebar config context value.
 */
export const useSidebarConfig = () => useContext(SidebarConfigContext);

/**
 * Provider that fetches the logged-in user's sidebar config on mount
 * and re-exposes it through context.
 *
 * @param children - React children.
 */
export const SidebarConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<SidebarConfig | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetch user profile on mount to get sidebarConfig.
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoaded(true);
      return;
    }

    axios
      .get(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (cancelled) return;
        const parsed = parseSidebarConfig(res.data?.sidebarConfig);
        setConfig(parsed);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });

    return () => { cancelled = true; };
  }, []);

  const sidebarItems = mergeSidebarConfig(config);

  /**
   * Persists a new sidebar config to the backend and updates local state.
   *
   * @param newConfig - The new sidebar configuration.
   */
  const saveSidebarConfig = useCallback(async (newConfig: SidebarConfig) => {
    setConfig(newConfig);
    try {
      const token = localStorage.getItem('access_token');
      await axios.patch(
        `${API_BASE_URL}/users/me/preferences`,
        { sidebarConfig: JSON.stringify(newConfig) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      console.error('Failed to save sidebar config', err);
    }
  }, []);

  /**
   * Resets sidebar config to defaults both locally and on the backend.
   */
  const resetSidebarConfig = useCallback(async () => {
    setConfig(null);
    try {
      const token = localStorage.getItem('access_token');
      await axios.patch(
        `${API_BASE_URL}/users/me/preferences`,
        { sidebarConfig: null },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      console.error('Failed to reset sidebar config', err);
    }
  }, []);

  return (
    <SidebarConfigContext.Provider value={{ sidebarItems, loaded, saveSidebarConfig, resetSidebarConfig }}>
      {children}
    </SidebarConfigContext.Provider>
  );
};

export default SidebarConfigContext;
