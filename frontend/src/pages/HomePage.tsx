// dm-app/frontend/src/pages/HomePage.tsx
import { Typography, Box } from '@mui/material'; // Importar componentes de MUI
import SettingsSection from './SettingsSection';
import { useTranslation } from 'react-i18next';

const HomePage = () => {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('welcome')}
      </Typography>
      <Typography variant="body1" paragraph>
        {t('home_body')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('home_hint')}
      </Typography>
      <SettingsSection />
    </Box>
  );
};

export default HomePage;