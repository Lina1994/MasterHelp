import { createContext, useContext, useMemo, useState } from 'react';
import type { DiaryDayRef } from '../../api/diary/diaryApi';

export type DiarySelectedDayInfo = {
  label: string;
  campaignId: string;
  day: DiaryDayRef;
} | null;

const SHOW_DAY_KEY = 'diary_showSelectedDayInSidebar';
const SHOW_DAY_IN_SKYLINE_KEY = 'diary_showSelectedDayInSkyline';
const SELECTED_DAY_KEY = 'app.diary.selectedDay';
const SHOW_NO_ACTIVE_SESSION_WARNING_KEY = 'diary_showNoActiveSessionWarning';
const SHOW_DAY_NAVIGATION_KEY = 'diary_showDayNavigation';
const DAY_FORMAT_KEY = 'diary_dayFormat';

export type DayFormat = 'extended' | 'compact';

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

function loadShowNoActiveSessionWarning(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_NO_ACTIVE_SESSION_WARNING_KEY);
    if (raw === null) return false; // default deshabilitado
    return raw === 'true';
  } catch {
    return false;
  }
}

function loadShowDayNavigation(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_DAY_NAVIGATION_KEY);
    if (raw === null) return false; // default deshabilitado
    return raw === 'true';
  } catch {
    return false;
  }
}

function loadDayFormat(): DayFormat {
  try {
    const raw = localStorage.getItem(DAY_FORMAT_KEY);
    if (raw === 'compact') return 'compact';
    return 'extended'; // default
  } catch {
    return 'extended';
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

function persistShowNoActiveSessionWarning(value: boolean) {
  try {
    localStorage.setItem(SHOW_NO_ACTIVE_SESSION_WARNING_KEY, String(value));
  } catch {
    // ignore
  }
}

function persistShowDayNavigation(value: boolean) {
  try {
    localStorage.setItem(SHOW_DAY_NAVIGATION_KEY, String(value));
  } catch {
    // ignore
  }
}

function persistDayFormat(value: DayFormat) {
  try {
    localStorage.setItem(DAY_FORMAT_KEY, value);
  } catch {
    // ignore
  }
}

function loadSelectedDay(): DiarySelectedDayInfo {
  try {
    const raw = localStorage.getItem(SELECTED_DAY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DiarySelectedDayInfo;
  } catch {
    return null;
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
  showNoActiveSessionWarning: boolean;
  setShowNoActiveSessionWarning: (value: boolean) => void;
  showDayNavigation: boolean;
  setShowDayNavigation: (value: boolean) => void;
  dayFormat: DayFormat;
  setDayFormat: (value: DayFormat) => void;
  activeSessionId: string | null;
  setActiveSessionId: (value: string | null) => void;
};

const DiarySidebarContext = createContext<DiarySidebarContextValue | undefined>(undefined);

/**
 * Provides diary UI state that needs to surface in the sidebar (e.g. selected day).
 */
export function DiarySidebarProvider({ children }: { children: React.ReactNode }) {
  const [selectedDay, setSelectedDayState] = useState<DiarySelectedDayInfo>(loadSelectedDay);
  const [showSelectedDayInSidebar, setShowSelectedDayInSidebarState] = useState<boolean>(loadShowSelectedDayInSidebar);
  const [showSelectedDayInSkyline, setShowSelectedDayInSkylineState] = useState<boolean>(loadShowSelectedDayInSkyline);
  const [showNoActiveSessionWarning, setShowNoActiveSessionWarningState] = useState<boolean>(loadShowNoActiveSessionWarning);
  const [showDayNavigation, setShowDayNavigationState] = useState<boolean>(loadShowDayNavigation);
  const [dayFormat, setDayFormatState] = useState<DayFormat>(loadDayFormat);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);

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

  const setShowNoActiveSessionWarning = (value: boolean) => {
    setShowNoActiveSessionWarningState(value);
    persistShowNoActiveSessionWarning(value);
  };

  const setShowDayNavigation = (value: boolean) => {
    setShowDayNavigationState(value);
    persistShowDayNavigation(value);
  };

  const setDayFormat = (value: DayFormat) => {
    setDayFormatState(value);
    persistDayFormat(value);
  };

  const setActiveSessionId = (value: string | null) => {
    setActiveSessionIdState(value);
  };

  const value = useMemo(
    () => ({
      selectedDay,
      setSelectedDay,
      showSelectedDayInSidebar,
      setShowSelectedDayInSidebar,
      showSelectedDayInSkyline,
      setShowSelectedDayInSkyline,
      showNoActiveSessionWarning,
      setShowNoActiveSessionWarning,
      showDayNavigation,
      setShowDayNavigation,
      dayFormat,
      setDayFormat,
      activeSessionId,
      setActiveSessionId,
    }),
    [selectedDay, showSelectedDayInSidebar, showSelectedDayInSkyline, showNoActiveSessionWarning, showDayNavigation, dayFormat, activeSessionId],
  );

  return <DiarySidebarContext.Provider value={value}>{children}</DiarySidebarContext.Provider>;
}

export function useDiarySidebar() {
  const ctx = useContext(DiarySidebarContext);
  if (!ctx) throw new Error('useDiarySidebar must be used within DiarySidebarProvider');
  return ctx;
}
