import { useState } from 'react';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Divider, IconButton, Typography
} from '@mui/material';
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
import MusicNoteIcon from '@mui/icons-material/MusicNote'; // nuevo icono
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MapIcon from '@mui/icons-material/Map';
import PeopleIcon from '@mui/icons-material/People';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import EventNoteIcon from '@mui/icons-material/EventNote';

const MainLayoutInner = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeCampaign } = useActiveCampaign(); // Usar el hook personalizado
  const { selectedDay, showSelectedDayInSidebar } = useDiarySidebar();

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
        <ListItem key="diary" disablePadding>
          <ListItemButton onClick={() => navigate('/diary')} disabled={!activeCampaign?.id}>
            <ListItemIcon><EventNoteIcon /></ListItemIcon>
            <ListItemText primary={t('diary', 'Diario')} />
          </ListItemButton>
        </ListItem>
        {/* Bestiary: accesible dentro de cada manual, no en el sidebar global */}
        {/* Más items aquí */}
      </List>

      {showSelectedDayInSidebar && activeCampaign?.id && selectedDay?.campaignId === activeCampaign.id ? (
        <Box sx={{ px: 2, pb: 1 }}>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="body2">{selectedDay.label}</Typography>
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
