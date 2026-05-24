import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type WorkspaceMode = 'default' | 'scenesEditor';

interface LayoutChromeContextValue {
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
}

const LayoutChromeContext = createContext<LayoutChromeContextValue | undefined>(undefined);

/**
 * Provides layout chrome state so feature pages can request a focused workspace mode.
 *
 * @param children - Descendant React nodes that can read/update workspace mode.
 * @returns Provider wrapper for layout chrome state.
 */
export function LayoutChromeProvider({ children }: { children: ReactNode }) {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('default');

  const value = useMemo(
    () => ({ workspaceMode, setWorkspaceMode }),
    [workspaceMode],
  );

  return (
    <LayoutChromeContext.Provider value={value}>
      {children}
    </LayoutChromeContext.Provider>
  );
}

/**
 * Returns layout chrome controls for toggling focused workspace modes.
 *
 * @returns Current workspace mode and setter.
 */
export function useLayoutChrome(): LayoutChromeContextValue {
  const context = useContext(LayoutChromeContext);
  if (!context) {
    throw new Error('useLayoutChrome must be used within a LayoutChromeProvider');
  }
  return context;
}
