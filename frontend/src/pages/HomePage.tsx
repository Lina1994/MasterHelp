// dm-app/frontend/src/pages/HomePage.tsx
import { Typography, Box } from '@mui/material'; // Importar componentes de MUI

const HomePage = () => {
  return (
    <Box sx={{ p: 2 }}> {/* Contenedor principal con padding */}
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome to the Dungeon Master App!
      </Typography>
      <Typography variant="body1" paragraph>
        You are logged in and can manage your campaigns.
      </Typography>
      {/* Aquí irá el contenido principal de la página de inicio */}
      {/* Puedes añadir más componentes de MUI como Cards, Lists, etc. */}
      <Typography variant="body2" color="text.secondary">
        Start by exploring the navigation menu.
      </Typography>
    </Box>
  );
};

export default HomePage;