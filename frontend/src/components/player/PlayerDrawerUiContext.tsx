import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

interface PlayerDrawerUiContextType {
  sfxExpanded: boolean;
  setSfxExpanded: (v: boolean) => void;
  toggleSfxExpanded: () => void;
}

const PlayerDrawerUiContext = createContext<PlayerDrawerUiContextType | undefined>(undefined);

export const PlayerDrawerUiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sfxExpanded, setSfxExpanded] = useState(false);
  const value = useMemo(() => ({
    sfxExpanded,
    setSfxExpanded,
    toggleSfxExpanded: () => setSfxExpanded(v => !v),
  }), [sfxExpanded]);
  return <PlayerDrawerUiContext.Provider value={value}>{children}</PlayerDrawerUiContext.Provider>;
};

export const usePlayerDrawerUi = () => {
  const ctx = useContext(PlayerDrawerUiContext);
  if (!ctx) throw new Error('usePlayerDrawerUi must be used within PlayerDrawerUiProvider');
  return ctx;
};
