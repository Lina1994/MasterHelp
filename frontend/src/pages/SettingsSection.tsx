import { Button, Paper, Typography, Box, Stack, FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useContext } from 'react';
import ThemeContext from '../ThemeContext';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
const SettingsSection = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [openLogout, setOpenLogout] = useState(false);
  const { mode, setMode, primary, setPrimary, secondary, setSecondary, background, setBackground } = useContext(ThemeContext);
  const handleChangeTheme = (event: any) => {
    setMode(event.target.value);
  };

  const handleChangeLanguage = (event: any) => {
    i18n.changeLanguage(event.target.value);
    localStorage.setItem('lang', event.target.value);
  };

  const handleLogout = () => setOpenLogout(true);
  const handleCancelLogout = () => setOpenLogout(false);
  const handleConfirmLogout = () => {
    setOpenLogout(false);
    localStorage.removeItem('access_token');
    navigate('/login');
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        {t('settings_title')}
      </Typography>
      <Stack spacing={2}>
        <Button variant="outlined" color="primary" onClick={() => navigate('/change-password')}>
          {t('change_password')}
        </Button>
        <Button variant="outlined" color="error" onClick={() => navigate('/delete-account')}>
          {t('delete_account')}
        </Button>
        <FormControl fullWidth>
          <InputLabel id="language-select-label">{t('language')}</InputLabel>
          <Select
            labelId="language-select-label"
            value={i18n.language}
            label={t('language')}
            onChange={handleChangeLanguage}
          >
            <MenuItem value="es">{t('spanish')}</MenuItem>
            <MenuItem value="en">{t('english')}</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="theme-select-label">{t('theme', 'Tema')}</InputLabel>
          <Select
            labelId="theme-select-label"
            value={mode}
            label={t('theme', 'Tema')}
            onChange={handleChangeTheme}
          >
            <MenuItem value="light">{t('light', 'Claro')}</MenuItem>
            <MenuItem value="dark">{t('dark', 'Oscuro')}</MenuItem>
            <MenuItem value="custom">{t('custom', 'Personalizado')}</MenuItem>
          </Select>
        </FormControl>
        {mode === 'custom' && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">{t('primary_color', 'Color primario')}</Typography>
            <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} style={{ width: 40, height: 40, border: 'none', background: 'none' }} />
            <Typography variant="body2" sx={{ mt: 1 }}>{t('secondary_color', 'Color secundario')}</Typography>
            <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)} style={{ width: 40, height: 40, border: 'none', background: 'none' }} />
            <Typography variant="body2" sx={{ mt: 1 }}>{t('background_color', 'Color de fondo')}</Typography>
            <input type="color" value={background} onChange={e => setBackground(e.target.value)} style={{ width: 40, height: 40, border: 'none', background: 'none' }} />
          </Box>
        )}
        <Button variant="outlined" color="secondary" onClick={handleLogout}>
          {t('logout')}
        </Button>
      </Stack>
      <Dialog open={openLogout} onClose={handleCancelLogout}>
        <DialogTitle>{t('logout')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('logout_confirm', '¿Estás seguro de que deseas cerrar la sesión?')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelLogout} color="primary">
            {t('cancel')}
          </Button>
          <Button onClick={handleConfirmLogout} color="secondary" autoFocus>
            {t('logout')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default SettingsSection;
