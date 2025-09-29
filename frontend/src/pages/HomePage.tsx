// dm-app/frontend/src/pages/HomePage.tsx
import { Typography, Box, IconButton, Menu, MenuItem, Paper } from '@mui/material';
import SettingsSection from './SettingsSection';
import SettingsIcon from '@mui/icons-material/Settings';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const HomePage = () => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <Box sx={{ p: 2, position: 'relative' }}>
      <IconButton
        aria-label="settings"
        onClick={handleOpen}
        sx={{ position: 'absolute', top: 8, right: 8 }}
      >
        <SettingsIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { p: 0, minWidth: 320 } }}
      >
        <Box sx={{ p: 2 }}>
          <SettingsSection />
        </Box>
      </Menu>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('welcome')}
      </Typography>
      <Typography variant="body1" paragraph>
        {t('home_body')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('home_hint')}
      </Typography>
    </Box>
  );
};

export default HomePage;