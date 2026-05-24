import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  AppBar, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Divider, IconButton, Toolbar, Typography, Stack
} from '@mui/material';
import { getDiaryCalendar, type DiaryCalendarConfig } from '../api/diary/diaryApi';
import { formatDayLabel, formatDayLabelCompact } from '../components/diary/diaryUtils';
import { getCurrentUser } from '../utils/getCurrentUser';
import logo from '../assets/logo.png';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TITLEBAR_HEIGHT } from '../components/TitleBar';

/** True cuando la app corre dentro de Electron; false en navegador web. */
const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI;
/** Altura efectiva de la barra de título: 0 en el navegador, normal en Electron. */
const TB = IS_ELECTRON ? TITLEBAR_HEIGHT : 0;
import { GlobalPlayerProvider } from '../components/player/GlobalPlayerContext';
import { SfxPlayerProvider } from '../components/player/SfxPlayerContext';
import { PlayerDrawerUiProvider } from '../components/player/PlayerDrawerUiContext';
import { DiarySidebarProvider, useDiarySidebar } from '../components/diary/DiarySidebarContext';
import TimeOfDaySidebarControls from '../components/player/TimeOfDaySidebarControls';
import GlobalPlayerDrawerControls from '../components/player/GlobalPlayerDrawerControls';
import SfxPlayerDrawerControls from '../components/player/SfxPlayerDrawerControls';
import MapAudioOrchestrator from '../components/Map/MapAudioOrchestrator';
import ShortcutRuntimeBridge from '../shortcuts/ShortcutRuntimeBridge';
import { InvitationsList } from '../pages/InvitationsList';
import { useSidebarConfig } from '../contexts/SidebarConfigContext';
import { DEFAULT_SIDEBAR_ITEMS } from '../constants/sidebarItems';
import SkylinePreviewOverlay from '../overlays/SkylinePreviewOverlay';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MapIcon from '@mui/icons-material/Map';
import PeopleIcon from '@mui/icons-material/People';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PetsIcon from '@mui/icons-material/Pets';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BoltIcon from '@mui/icons-material/Bolt';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import { ShortcutsProvider } from '../contexts/ShortcutsContext';
import { SidebarShortcutsPanel, ShortcutHotbar } from '../components/shortcuts/ShortcutsShell';
import ActiveScenesBar from '../components/scenes/ActiveScenesBar';
import { ActiveScenesProvider } from '../contexts/ActiveScenesContext';
import { LayoutChromeProvider, useLayoutChrome } from '../contexts/LayoutChromeContext';

/** Maps iconName strings (from SidebarItemDef) to actual MUI icon elements. */
const ICON_MAP: Record<string, ReactElement> = {
  FolderSpecial: <FolderSpecialIcon />,
  Bolt: <BoltIcon />,
  MusicNote: <MusicNoteIcon />,
  MenuBook: <MenuBookIcon />,
  Map: <MapIcon />,
  SportsKabaddi: <SportsKabaddiIcon />,
  People: <PeopleIcon />,
  Assignment: <AssignmentIcon />,
  Storefront: <StorefrontIcon />,
  AutoStories: <AutoStoriesIcon />,
  EventNote: <EventNoteIcon />,
  Pets: <PetsIcon />,
  AutoFixHigh: <AutoFixHighIcon />,
  TheaterComedy: <TheaterComedyIcon />,
};

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some((p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master');
}

const MainLayoutInner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeCampaign } = useActiveCampaign();
  const { selectedDay, showSelectedDayInSidebar, showNoActiveSessionWarning, showDayNavigation, dayFormat, activeSessionId, setSelectedDay } = useDiarySidebar();
  const [calendarConfig, setCalendarConfig] = useState<DiaryCalendarConfig | null>(null);
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);
  const { sidebarItems } = useSidebarConfig();
  const { workspaceMode } = useLayoutChrome();
  const isScenesEditorWorkspace = workspaceMode === 'scenesEditor' && location.pathname.startsWith('/scenes');

  // Auto-cargar el día actual del calendario si hay campaña activa y no hay día seleccionado
  useEffect(() => {
    let cancelled = false;
    
    // Solo cargar si showSelectedDayInSidebar está activo
    if (!showSelectedDayInSidebar || !activeCampaign?.id) return;
    
    // Si ya hay un día seleccionado de esta campaña, no hacer nada
    if (selectedDay?.campaignId === activeCampaign.id) return;
    
    // Cargar calendario y establecer día actual
    (async () => {
      try {
        const calendarData = await getDiaryCalendar(activeCampaign.id);
        if (!cancelled && calendarData?.config) {
          const config = calendarData.config;
          const defaultDay = { year: config.currentYear, monthIndex: 0, dayIndex: 1 };
          const label = dayFormat === 'compact' ? formatDayLabelCompact(config, defaultDay) : formatDayLabel(config, defaultDay);
          setSelectedDay({ label, campaignId: activeCampaign.id, day: defaultDay });
        }
      } catch {
        // Si hay error al cargar el calendario, no hacer nada
      }
    })();
    
    return () => { cancelled = true; };
  }, [activeCampaign?.id, selectedDay?.campaignId, showSelectedDayInSidebar, dayFormat, setSelectedDay]);

  // Cargar configuración del calendario para los controles de navegación
  useEffect(() => {
    let cancelled = false;
    
    if (!activeCampaign?.id || !showDayNavigation) {
      setCalendarConfig(null);
      return;
    }
    
    (async () => {
      try {
        const calendarData = await getDiaryCalendar(activeCampaign.id);
        if (!cancelled && calendarData?.config) {
          setCalendarConfig(calendarData.config);
        }
      } catch {
        if (!cancelled) setCalendarConfig(null);
      }
    })();
    
    return () => { cancelled = true; };
  }, [activeCampaign?.id, showDayNavigation]);

  // Navegar al día anterior
  const goToPreviousDay = async () => {
    if (!selectedDay?.day || !calendarConfig || !activeCampaign?.id) return;
    
    const { year, monthIndex, dayIndex } = selectedDay.day;
    let newYear = year;
    let newMonthIndex = monthIndex;
    let newDayIndex = dayIndex - 1;
    
    if (newDayIndex < 1) {
      // Ir al mes anterior
      newMonthIndex -= 1;
      if (newMonthIndex < 0) {
        // Ir al año anterior
        newYear -= 1;
        newMonthIndex = calendarConfig.months.length - 1;
      }
      newDayIndex = calendarConfig.months[newMonthIndex]?.days || 30;
    }
    
    const newDay = { year: newYear, monthIndex: newMonthIndex, dayIndex: newDayIndex };
    const label = dayFormat === 'compact' ? formatDayLabelCompact(calendarConfig, newDay) : formatDayLabel(calendarConfig, newDay);
    setSelectedDay({ label, campaignId: activeCampaign.id, day: newDay });
    
    // Update current day in backend if user is master
    if (isMaster && activeCampaign.id) {
      const { updateCurrentDay } = await import('../api/diary/diaryApi');
      try {
        const saved = await updateCurrentDay(activeCampaign.id, newMonthIndex, newDayIndex);
        // Update local calendar config to reflect the change
        setCalendarConfig(saved.config);
      } catch (e) {
        console.error('Failed to update current day:', e);
      }
    }
  };

  // Navegar al día siguiente
  const goToNextDay = async () => {
    if (!selectedDay?.day || !calendarConfig || !activeCampaign?.id) return;
    
    const { year, monthIndex, dayIndex } = selectedDay.day;
    const currentMonth = calendarConfig.months[monthIndex];
    if (!currentMonth) return;
    
    let newYear = year;
    let newMonthIndex = monthIndex;
    let newDayIndex = dayIndex + 1;
    
    if (newDayIndex > currentMonth.days) {
      // Ir al mes siguiente
      newDayIndex = 1;
      newMonthIndex += 1;
      if (newMonthIndex >= calendarConfig.months.length) {
        // Ir al año siguiente
        newYear += 1;
        newMonthIndex = 0;
      }
    }
    
    const newDay = { year: newYear, monthIndex: newMonthIndex, dayIndex: newDayIndex };
    const label = dayFormat === 'compact' ? formatDayLabelCompact(calendarConfig, newDay) : formatDayLabel(calendarConfig, newDay);
    setSelectedDay({ label, campaignId: activeCampaign.id, day: newDay });
    
    // Update current day in backend if user is master
    if (isMaster && activeCampaign.id) {
      const { updateCurrentDay } = await import('../api/diary/diaryApi');
      try {
        const saved = await updateCurrentDay(activeCampaign.id, newMonthIndex, newDayIndex);
        // Update local calendar config to reflect the change
        setCalendarConfig(saved.config);
      } catch (e) {
        console.error('Failed to update current day:', e);
      }
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  /** Label shown in the mobile top bar matching the current route. */
  const currentPageLabel = useMemo(() => {
    const matched = DEFAULT_SIDEBAR_ITEMS.find(
      (item) => location.pathname === item.route || location.pathname.startsWith(item.route + '/'),
    );
    if (matched) return t(matched.labelKey, matched.fallback);
    if (location.pathname === '/' || location.pathname === '') return t('home', 'Inicio');
    return t('settings', 'Ajustes');
  }, [location.pathname, t]);

  // Contenido base del drawer SIN el reproductor (para evitar montarlo duplicado).
  const drawerContent = (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2, minHeight: 72 }}>
        <IconButton onClick={() => navigate('/')} sx={{ p: 0 }}>
          {activeCampaign && activeCampaign.imageUrl ? (
            <img
              src={activeCampaign.imageUrl}
              alt={activeCampaign.name}
              style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }}
            />
          ) : activeCampaign ? (
            <span style={{ fontWeight: 600, fontSize: 18, maxWidth: 80, textAlign: 'center', display: 'block' }}>
              {activeCampaign.name}
            </span>
          ) : (
            <img src={logo} alt="Logo" style={{ width: 56, height: 56, borderRadius: 8 }} />
          )}
        </IconButton>
      </Box>
      <Divider />
      <List sx={{ flex: 1, overflowY: 'auto' }}>
        {sidebarItems
          .filter((si) => si.visible)
          .map((si) => {
            const def = DEFAULT_SIDEBAR_ITEMS.find((d) => d.key === si.key);
            if (!def) return null;
            if (def.masterOnly && !isMaster) return null;
            const disabled = !!def.requiresCampaign && !activeCampaign?.id;
            return (
              <ListItem key={def.key} disablePadding>
                <ListItemButton onClick={() => navigate(def.route)} disabled={disabled}>
                  <ListItemIcon>{ICON_MAP[def.iconName] ?? null}</ListItemIcon>
                  <ListItemText primary={t(def.labelKey, def.fallback)} />
                </ListItemButton>
              </ListItem>
            );
          })}
      </List>

      {showSelectedDayInSidebar && activeCampaign?.id && selectedDay?.campaignId === activeCampaign.id ? (
        <Box sx={{ px: 2, pb: 1 }}>
          <Divider sx={{ mb: 1 }} />
          {showDayNavigation && calendarConfig ? (
            <Stack direction="row" alignItems="center" gap={0.5}>
              <IconButton size="small" onClick={goToPreviousDay} sx={{ p: 0.5 }}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <Typography variant="body2" sx={{ flex: 1, textAlign: 'center' }}>
                {selectedDay.label}
              </Typography>
              <IconButton size="small" onClick={goToNextDay} sx={{ p: 0.5 }}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Stack>
          ) : (
            <Typography variant="body2">{selectedDay.label}</Typography>
          )}
        </Box>
      ) : null}

      {showNoActiveSessionWarning && activeCampaign?.id && !activeSessionId ? (
        <Box sx={{ px: 2, pb: 1 }}>
          <Divider sx={{ mb: 1 }} />
          <Box
            onClick={() => navigate('/diary?tab=sessions&highlight=start')}
            sx={{
              cursor: 'pointer',
              '&:hover': { opacity: 0.8 },
              transition: 'opacity 0.2s',
            }}
          >
            <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'medium' }}>
              ⚠️ No hay sesión activa
            </Typography>
          </Box>
        </Box>
      ) : null}

      {isMaster ? <SidebarShortcutsPanel /> : null}
    </>
  );

  return (
    <GlobalPlayerProvider>
      <SfxPlayerProvider>
        <PlayerDrawerUiProvider>
          <ShortcutsProvider>
            <ActiveScenesProvider>
          <ShortcutRuntimeBridge />
          <Box sx={{ display: 'flex', height: `calc(100vh - ${TB}px)` }}>
            {/* ── Barra superior responsive (sólo en móvil / ventana estrecha) ── */}
            <AppBar
              position="fixed"
              elevation={1}
              sx={{
                display: isScenesEditorWorkspace ? 'none' : { xs: 'flex', sm: 'none' },
                top: TB,
                bgcolor: 'background.paper',
                color: 'text.primary',
                zIndex: (theme) => theme.zIndex.appBar,
              }}
            >
              <Toolbar sx={{ minHeight: 56 }}>
                <IconButton
                  edge="start"
                  onClick={handleDrawerToggle}
                  aria-label={t('openMenu', 'Abrir menú')}
                  sx={{ p: 0.5, mr: 1 }}
                >
                  {activeCampaign?.imageUrl ? (
                    <img
                      src={activeCampaign.imageUrl}
                      alt={activeCampaign.name}
                      style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }}
                    />
                  ) : (
                    <img src={logo} alt="Logo" style={{ width: 36, height: 36, borderRadius: 6 }} />
                  )}
                </IconButton>
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ maxWidth: 220 }}>
                  {currentPageLabel}
                </Typography>
              </Toolbar>
            </AppBar>
            {/* Headless orchestrator to auto-play map audio based on active map and time-of-day */}
            <MapAudioOrchestrator />
            {isScenesEditorWorkspace ? null : (
              <Box
                component="nav"
                sx={{ width: { sm: 240 }, flexShrink: { sm: 0 } }}
                aria-label="sidebar navigation"
              >
                {/* Drawer temporal (mobile): NO incluye reproductor para evitar doble <audio> oculto. */}
                <Drawer
                  variant="temporary"
                  open={mobileOpen}
                  onClose={handleDrawerToggle}
                  ModalProps={{ keepMounted: true }}
                  sx={{
                    display: { xs: 'block', sm: 'none' },
                    '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {drawerContent}
                    {/* Opcional: si se quiere el reproductor también en mobile, moverlo aquí y asegurarse de desmontar el permanente. */}
                  </Box>
                </Drawer>
                {/* Drawer permanente (desktop): ÚNICO lugar donde se monta el reproductor */}
                <Drawer
                  variant="permanent"
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    '& .MuiDrawer-paper': {
                      boxSizing: 'border-box',
                      width: 240,
                      top: `${TB}px`,
                      height: `calc(100% - ${TB}px)`,
                    },
                  }}
                  open
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {drawerContent}
                    <TimeOfDaySidebarControls />
                    <GlobalPlayerDrawerControls />
                    <SfxPlayerDrawerControls />
                  </Box>
                </Drawer>
              </Box>
            )}
            <Box
              component="main"
              sx={{
                flexGrow: 1,
                width: isScenesEditorWorkspace ? '100%' : { sm: `calc(100% - 240px)` },
                height: `calc(100vh - ${TB}px)`,
                overflow: 'auto',
                display: isScenesEditorWorkspace ? 'flex' : 'block',
                flexDirection: isScenesEditorWorkspace ? 'column' : undefined,
                p: isScenesEditorWorkspace ? { xs: 1, sm: 1.5 } : 3,
                pb: isScenesEditorWorkspace ? { xs: 1, sm: 1.5 } : { xs: 20, sm: 22 },
                // On xs the fixed mobile AppBar (56px) sits above the content;
                // extra top padding prevents content from hiding behind it.
                pt: isScenesEditorWorkspace ? { xs: 1, sm: 1.5 } : { xs: `calc(56px + ${TB}px + 24px)`, sm: 3 },
              }}
            >
              {isScenesEditorWorkspace ? null : (
                <div style={{ marginBottom: 24 }}>
                  <InvitationsList />
                </div>
              )}
              <Box
                sx={isScenesEditorWorkspace ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined}
              >
                <Outlet />
              </Box>
              {isMaster && !isScenesEditorWorkspace ? <ActiveScenesBar /> : null}
              {isMaster && !isScenesEditorWorkspace ? <ShortcutHotbar /> : null}
              <SkylinePreviewOverlay />
            </Box>
          </Box>
            </ActiveScenesProvider>
          </ShortcutsProvider>
        </PlayerDrawerUiProvider>
      </SfxPlayerProvider>
    </GlobalPlayerProvider>
  );
};

const MainLayout = () => (
  <DiarySidebarProvider>
    <LayoutChromeProvider>
      <MainLayoutInner />
    </LayoutChromeProvider>
  </DiarySidebarProvider>
);

export default MainLayout;
