import { useState } from 'react'; // Importar useState para el estado del drawer
// Importar componentes de MUI
import { AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Divider } from '@mui/material';
// Importar el icono desde @mui/icons-material
import MenuIcon from '@mui/icons-material/Menu';
import { Outlet, useNavigate } from 'react-router-dom';

const MainLayout = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false); // Estado para controlar el drawer en móvil

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    navigate('/login');
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <div>
      <Toolbar />
      <Divider />
      <List>
        {/* Item Home */}
        <ListItem key="Home" disablePadding>
          <ListItemButton onClick={() => navigate('/')}>
            <ListItemIcon>
              {/* <InboxIcon /> */}
            </ListItemIcon>
            <ListItemText primary="Home" />
          </ListItemButton>
        </ListItem>
        {/* Nuevo item para Change Password */}
        <ListItem key="Change Password" disablePadding>
          <ListItemButton onClick={() => navigate('/change-password')}>
            <ListItemIcon>
              {/* <LockIcon /> Puedes añadir un icono aquí si instalas @mui/icons-material */}
            </ListItemIcon>
            <ListItemText primary="Change Password" />
          </ListItemButton>
        </ListItem>
        {/* Puedes añadir más items aquí */}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }} // Mostrar solo en móviles
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Dungeon Master App
          </Typography>
          <Box sx={{ flexGrow: 1 }} /> {/* Empuja el botón de logout a la derecha */}
          <IconButton color="inherit" onClick={handleLogout}>
            <Typography color="inherit">Logout</Typography>
          </IconButton>
        </Toolbar>
      </AppBar>
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
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - 240px)` } }} // Ajustar el ancho del contenido principal
      >
        <Toolbar /> {/* Espacio para el AppBar fijo */}
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;