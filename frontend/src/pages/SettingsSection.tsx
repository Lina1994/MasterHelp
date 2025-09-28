import { Button, Paper, Typography, Box, Stack, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SettingsSection = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleChangeLanguage = (event: any) => {
    i18n.changeLanguage(event.target.value);
    localStorage.setItem('lang', event.target.value);
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
      </Stack>
    </Paper>
  );
};

export default SettingsSection;
