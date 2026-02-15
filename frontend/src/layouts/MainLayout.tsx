import { useEffect, useState } from 'react';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Divider, IconButton, Typography, Stack
} from '@mui/material';
import { getDiaryCalendar, type DiaryCalendarConfig } from '../api/diary/diaryApi';
import { formatDayLabel, formatDayLabelCompact } from '../components/diary/diaryUtils';
import { getCurrentUser } from '../utils/getCurrentUser';
import logo from '../assets/logo.png';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { Outlet, useNavigate } from 'react-router-dom';
import { GlobalPlayerProvider } from '../components/player/GlobalPlayerContext';
import { SfxPlayerProvider } from '../components/player/SfxPlayerContext';
import { PlayerDrawerUiProvider } from '../components/player/PlayerDrawerUiContext';
import { DiarySidebarProvider, useDiarySidebar } from '../components/diary/DiarySidebarContext';
import TimeOfDaySidebarControls from '../components/player/TimeOfDaySidebarControls';
import GlobalPlayerDrawerControls from '../components/player/GlobalPlayerDrawerControls';
import SfxPlayerDrawerControls from '../components/player/SfxPlayerDrawerControls';
import MapAudioOrchestrator from '../components/Map/MapAudioOrchestrator';
import { InvitationsList } from '../pages/InvitationsList';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MapIcon from '@mui/icons-material/Map';
import PeopleIcon from '@mui/icons-material/People';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PetsIcon from '@mui/icons-material/Pets';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some((p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master');
}

const MainLayoutInner = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeCampaign } = useActiveCampaign();
  const { selectedDay, showSelectedDayInSidebar, showNoActiveSessionWarning, showDayNavigation, dayFormat, activeSessionId, setSelectedDay } = useDiarySidebar();
  const [calendarConfig, setCalendarConfig] = useState<DiaryCalendarConfig | null>(null);
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);

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
        <ListItem key="campaigns" disablePadding>
          <ListItemButton onClick={() => navigate('/campaigns')}>
            <ListItemIcon />
            <ListItemText primary={t('campaigns', 'Campañas')} />
          </ListItemButton>
        </ListItem>
        <ListItem key="soundtrack" disablePadding>
          <ListItemButton onClick={() => navigate('/soundtrack')}>
            <ListItemIcon><MusicNoteIcon /></ListItemIcon>
            <ListItemText primary={t('soundtrack', 'Soundtrack')} />
          </ListItemButton>
        </ListItem>
        <ListItem key="manuals" disablePadding>
          <ListItemButton onClick={() => navigate('/manuals')}>
            <ListItemIcon><MenuBookIcon /></ListItemIcon>
            <ListItemText primary={t('manuals', 'Manuales')} />
          </ListItemButton>
        </ListItem>
        <ListItem key="maps" disablePadding>
          <ListItemButton onClick={() => navigate('/maps')}>
            <ListItemIcon><MapIcon /></ListItemIcon>
            <ListItemText primary={t('maps', 'Mapas')} />
          </ListItemButton>
        </ListItem>
        <ListItem key="combat" disablePadding>
          <ListItemButton onClick={() => navigate('/combat')} disabled={!activeCampaign?.id}>
            <ListItemIcon><SportsKabaddiIcon /></ListItemIcon>
            <ListItemText primary="Combate" />
          </ListItemButton>
        </ListItem>
        <ListItem key="characters" disablePadding>
          <ListItemButton onClick={() => navigate('/characters')} disabled={!activeCampaign?.id}>
            <ListItemIcon><PeopleIcon /></ListItemIcon>
            <ListItemText primary={t('characters', 'Personajes')} />
          </ListItemButton>
        </ListItem>
        <ListItem key="quests" disablePadding>
          <ListItemButton onClick={() => navigate('/quests')} disabled={!activeCampaign?.id}>
            <ListItemIcon><AssignmentIcon /></ListItemIcon>
            <ListItemText primary={t('quests', 'Misiones')} />
          </ListItemButton>
        </ListItem>
        <ListItem key="diary" disablePadding>
          <ListItemButton onClick={() => navigate('/diary')} disabled={!activeCampaign?.id}>
            <ListItemIcon><EventNoteIcon /></ListItemIcon>
            <ListItemText primary={t('diary', 'Diario')} />
          </ListItemButton>
        </ListItem>
        <ListItem key="campaign-bestiary" disablePadding>
          <ListItemButton onClick={() => navigate('/campaign-bestiary')} disabled={!activeCampaign?.id}>
            <ListItemIcon><PetsIcon /></ListItemIcon>
            <ListItemText primary={t('bestiary', 'Bestiario')} />
          </ListItemButton>
        </ListItem>
        {/* Más items aquí */}
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
    </>
  );

  return (
    <GlobalPlayerProvider>
      <SfxPlayerProvider>
        <PlayerDrawerUiProvider>
          <Box sx={{ display: 'flex', height: '100vh' }}>
            {/* Headless orchestrator to auto-play map audio based on active map and time-of-day */}
            <MapAudioOrchestrator />
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
                  '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
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
            <Box
              component="main"
              sx={{ flexGrow: 1, width: { sm: `calc(100% - 240px)` }, height: '100vh', overflow: 'auto', p: 3 }}
            >
              <div style={{ marginBottom: 24 }}>
                <InvitationsList />
              </div>
              <Outlet />
            </Box>
          </Box>
        </PlayerDrawerUiProvider>
      </SfxPlayerProvider>
    </GlobalPlayerProvider>
  );
};

const MainLayout = () => (
  <DiarySidebarProvider>
    <MainLayoutInner />
  </DiarySidebarProvider>
);

export default MainLayout;
