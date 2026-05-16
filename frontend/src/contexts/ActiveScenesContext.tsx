import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cancelSceneExecution } from '../api/scenes';

export interface ActiveSceneExecutionItem {
  executionId: string;
  sceneId: string;
  sceneName: string;
  icon?: string | null;
  imageUrl?: string | null;
  loop: boolean;
  startedAtMs: number;
}

interface ActiveScenesContextValue {
  activeScenes: ActiveSceneExecutionItem[];
  requestStopExecution: (executionId: string) => Promise<void>;
}

const ActiveScenesContext = createContext<ActiveScenesContextValue>({
  activeScenes: [],
  requestStopExecution: async () => {},
});

/**
 * Tracks currently active scene executions announced by the runtime bridge.
 */
export const ActiveScenesProvider = ({ children }: { children: ReactNode }) => {
  const [activeScenes, setActiveScenes] = useState<ActiveSceneExecutionItem[]>([]);

  useEffect(() => {
    const handleExecutionStarted = (event: Event) => {
      const custom = event as CustomEvent<Partial<ActiveSceneExecutionItem>>;
      const executionId = String(custom.detail?.executionId || '').trim();
      const sceneId = String(custom.detail?.sceneId || '').trim();
      if (!executionId || !sceneId) return;

      const nextItem: ActiveSceneExecutionItem = {
        executionId,
        sceneId,
        sceneName: String(custom.detail?.sceneName || 'Escena activa'),
        icon: typeof custom.detail?.icon === 'string' ? custom.detail.icon : null,
        imageUrl: typeof custom.detail?.imageUrl === 'string' ? custom.detail.imageUrl : null,
        loop: Boolean(custom.detail?.loop),
        startedAtMs: Number.isFinite(Number(custom.detail?.startedAtMs))
          ? Number(custom.detail?.startedAtMs)
          : Date.now(),
      };

      setActiveScenes((current) => {
        const withoutExisting = current.filter((item) => item.executionId !== executionId);
        return [...withoutExisting, nextItem];
      });
    };

    const handleExecutionFinished = (event: Event) => {
      const custom = event as CustomEvent<{ executionId?: string }>;
      const executionId = String(custom.detail?.executionId || '').trim();
      if (!executionId) return;
      setActiveScenes((current) => current.filter((item) => item.executionId !== executionId));
    };

    window.addEventListener('scene:execution-started', handleExecutionStarted as EventListener);
    window.addEventListener('scene:execution-completed', handleExecutionFinished as EventListener);
    window.addEventListener('scene:execution-stopped', handleExecutionFinished as EventListener);

    return () => {
      window.removeEventListener('scene:execution-started', handleExecutionStarted as EventListener);
      window.removeEventListener('scene:execution-completed', handleExecutionFinished as EventListener);
      window.removeEventListener('scene:execution-stopped', handleExecutionFinished as EventListener);
    };
  }, []);

  const requestStopExecution = useCallback(async (executionId: string) => {
    if (!executionId) return;

    window.dispatchEvent(new CustomEvent('scene:execution-stop-request', {
      detail: { executionId },
    }));

    setActiveScenes((current) => current.filter((item) => item.executionId !== executionId));

    try {
      await cancelSceneExecution(executionId);
    } catch {
      // Runtime stop should still succeed locally even if backend history update fails.
    }
  }, []);

  const contextValue = useMemo<ActiveScenesContextValue>(() => ({
    activeScenes,
    requestStopExecution,
  }), [activeScenes, requestStopExecution]);

  return (
    <ActiveScenesContext.Provider value={contextValue}>
      {children}
    </ActiveScenesContext.Provider>
  );
};

export const useActiveScenes = (): ActiveScenesContextValue => useContext(ActiveScenesContext);

export default ActiveScenesContext;
