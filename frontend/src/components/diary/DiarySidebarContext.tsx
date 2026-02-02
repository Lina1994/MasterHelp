import { createContext, useContext, useMemo, useState } from 'react';

export type DiarySelectedDayInfo = {
  label: string;
  campaignId: string;
} | null;

const SHOW_DAY_KEY = 'diary_showSelectedDayInSidebar';
const SHOW_DAY_IN_SKYLINE_KEY = 'diary_showSelectedDayInSkyline';
const SELECTED_DAY_KEY = 'app.diary.selectedDay';

function loadShowSelectedDayInSidebar(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_DAY_KEY);
    if (raw === null) return true; // default
    return raw === 'true';
  } catch {
    return true;
  }
}

function loadShowSelectedDayInSkyline(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_DAY_IN_SKYLINE_KEY);
    if (raw === null) return true; // default
    return raw === 'true';
  } catch {
    return true;
  }
}

function persistShowSelectedDayInSidebar(value: boolean) {
  try {
    localStorage.setItem(SHOW_DAY_KEY, String(value));
  } catch {
    // ignore
  }
}

function persistShowSelectedDayInSkyline(value: boolean) {
  try {
    localStorage.setItem(SHOW_DAY_IN_SKYLINE_KEY, String(value));
  } catch {
    // ignore
  }
}

function persistSelectedDay(value: DiarySelectedDayInfo) {
  try {
    if (!value) {
      localStorage.removeItem(SELECTED_DAY_KEY);
      return;
    }
    localStorage.setItem(SELECTED_DAY_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

type DiarySidebarContextValue = {
  selectedDay: DiarySelectedDayInfo;
  setSelectedDay: (value: DiarySelectedDayInfo) => void;
  showSelectedDayInSidebar: boolean;
  setShowSelectedDayInSidebar: (value: boolean) => void;
  showSelectedDayInSkyline: boolean;
  setShowSelectedDayInSkyline: (value: boolean) => void;
};

const DiarySidebarContext = createContext<DiarySidebarContextValue | undefined>(undefined);

/**
 * Provides diary UI state that needs to surface in the sidebar (e.g. selected day).
 */
export function DiarySidebarProvider({ children }: { children: React.ReactNode }) {
  const [selectedDay, setSelectedDayState] = useState<DiarySelectedDayInfo>(null);
  const [showSelectedDayInSidebar, setShowSelectedDayInSidebarState] = useState<boolean>(loadShowSelectedDayInSidebar);
  const [showSelectedDayInSkyline, setShowSelectedDayInSkylineState] = useState<boolean>(loadShowSelectedDayInSkyline);

  const setSelectedDay = (value: DiarySelectedDayInfo) => {
    setSelectedDayState(value);
    persistSelectedDay(value);
  };

  const setShowSelectedDayInSidebar = (value: boolean) => {
    setShowSelectedDayInSidebarState(value);
    persistShowSelectedDayInSidebar(value);
  };

  const setShowSelectedDayInSkyline = (value: boolean) => {
    setShowSelectedDayInSkylineState(value);
    persistShowSelectedDayInSkyline(value);
  };

  const value = useMemo(
    () => ({
      selectedDay,
      setSelectedDay,
      showSelectedDayInSidebar,
      setShowSelectedDayInSidebar,
      showSelectedDayInSkyline,
      setShowSelectedDayInSkyline,
    }),
    [selectedDay, showSelectedDayInSidebar, showSelectedDayInSkyline],
  );

  return <DiarySidebarContext.Provider value={value}>{children}</DiarySidebarContext.Provider>;
}

export function useDiarySidebar() {
  const ctx = useContext(DiarySidebarContext);
  if (!ctx) throw new Error('useDiarySidebar must be used within DiarySidebarProvider');
  return ctx;
}
