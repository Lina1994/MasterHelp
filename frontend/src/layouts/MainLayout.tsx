import { useState } from 'react';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Divider, IconButton
} from '@mui/material';
import logo from '../assets/logo.png';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { Outlet, useNavigate } from 'react-router-dom';
import { GlobalPlayerProvider } from '../components/player/GlobalPlayerContext';
import GlobalPlayerDrawerControls from '../components/player/GlobalPlayerDrawerControls';
import { InvitationsList } from '../pages/InvitationsList';
import MusicNoteIcon from '@mui/icons-material/MusicNote'; // nuevo icono
import MenuBookIcon from '@mui/icons-material/MenuBook';

const MainLayout = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeCampaign } = useActiveCampaign(); // Usar el hook personalizado

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
        {/* Más items aquí */}
      </List>
    </>
  );

  return (
    <GlobalPlayerProvider>
      <Box sx={{ display: 'flex', height: '100vh' }}>
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
              <GlobalPlayerDrawerControls />
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
    </GlobalPlayerProvider>
  );
};

export default MainLayout;
