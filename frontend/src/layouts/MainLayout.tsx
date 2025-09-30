import { useState } from 'react'; // Importar useState para el estado del drawer
// Importar componentes de MUI
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Divider, IconButton } from '@mui/material';
// Importar el icono desde @mui/icons-material
// import MenuIcon from '@mui/icons-material/Menu';
import logo from '../assets/logo.png';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import ActiveCampaignContext from '../components/Campaign/ActiveCampaignContext';
import { Outlet, useNavigate } from 'react-router-dom';
import { InvitationsList } from '../pages/InvitationsList';
// import { DebugUserInfo } from '../components/DebugUserInfo';

const MainLayout = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false); // Estado para controlar el drawer en móvil

  // El logout ahora está en los ajustes, no aquí
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };


  const { activeCampaign } = useContext(ActiveCampaignContext);
  const drawer = (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2, minHeight: 72 }}>
        <IconButton onClick={() => navigate('/')} sx={{ p: 0 }}>
          {activeCampaign ? (
            activeCampaign.imageUrl ? (
              <img src={activeCampaign.imageUrl} alt={activeCampaign.name} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
            ) : (
              <span style={{ fontWeight: 600, fontSize: 18, maxWidth: 80, textAlign: 'center', display: 'block' }}>{activeCampaign.name}</span>
            )
          ) : (
            <img src={logo} alt="Logo" style={{ width: 56, height: 56, borderRadius: 8 }} />
          )}
        </IconButton>
      </Box>
      <Divider />
      <List>
        <ListItem key="campaigns" disablePadding>
          <ListItemButton onClick={() => navigate('/campaigns')}>
            <ListItemIcon />
            <ListItemText primary={t('campaigns', 'Campañas')} />
          </ListItemButton>
        </ListItem>
        {/* Puedes añadir más items aquí */}
      </List>
    </div>
  );

return (
  <Box sx={{ display: 'flex', height: '100vh' }}>
    <Box
      component="nav"
      sx={{ width: { sm: 240 }, flexShrink: { sm: 0 } }}
      aria-label="mailbox folders"
    >
      {/* Drawer para navegación lateral en desktop/móvil */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Mejora el rendimiento en móvil
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
    <Box
      component="main"
      sx={{ flexGrow: 1, width: { sm: `calc(100% - 240px)` }, height: '100vh', overflow: 'auto', p: 3 }}
    >
      {/* Invitaciones pendientes arriba del contenido principal */}
      <div style={{ marginBottom: 24 }}>
        <InvitationsList />
      </div>
      <Outlet />
    </Box>
  </Box>
);

}
export default MainLayout;