import {
  Button, Paper, Typography, Box, Stack, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Accordion, AccordionSummary, AccordionDetails,
  InputAdornment, OutlinedInput, Tooltip, Snackbar, Alert,
  Switch, FormControlLabel, IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TvIcon from '@mui/icons-material/Tv';
import TvOffIcon from '@mui/icons-material/TvOff';
import { useTranslation } from 'react-i18next';
import { useContext } from 'react';
import ThemeContext from '../ThemeContext';
import SidebarSettings from '../components/SidebarSettings';
import UpdateChecker from '../components/UpdateChecker';

import { useState, useEffect } from 'react';
import React from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import API_BASE_URL from '../apiBase';
import { useNavigate } from 'react-router-dom';
import { SKYLINE_PREVIEW_KEY } from '../overlays/SkylinePreviewOverlay';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getSkylineOverlaySettings, setSkylineOverlaySettings } from '../api/campaigns/skylineOverlay';

/** Response shape from GET /network-info */
interface NetworkInfo {
  localIps: string[];
  backendPort: number;
  frontendPort: number;
}
const SettingsSection = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const [openLogout, setOpenLogout] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  /** URL currently beamed to the Skyline overlay (empty string = none). */
  const [skylineQrUrl, setSkylineQrUrl] = useState<string>('');
  const [skylinePreview, setSkylinePreview] = useState<boolean>(
    () => localStorage.getItem(SKYLINE_PREVIEW_KEY) === 'true',
  );

  /**
   * Toggles the skyline preview overlay on/off, persists to localStorage and
   * dispatches a custom event so the overlay reacts within the same tab.
   *
   * @param enabled - New desired state.
   */
  const handleSkylinePreviewToggle = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setSkylinePreview(checked);
    localStorage.setItem(SKYLINE_PREVIEW_KEY, String(checked));
    window.dispatchEvent(new Event('skylinePreviewToggled'));
  };

  /** Construye las URLs de acceso LAN a partir de las IPs obtenidas del backend. */
  const webUrls: string[] = networkInfo
    ? networkInfo.localIps.map((ip) => `http://${ip}:${networkInfo.frontendPort}`)
    : [];

  /**
   * Llama al endpoint /network-info para obtener las IPs de red del host.
   * Se ejecuta una sola vez al montar el componente.
   */
  useEffect(() => {
    axios
      .get<NetworkInfo>(`${API_BASE_URL}/network-info`)
      .then((res) => setNetworkInfo(res.data))
      .catch(() => { /* sin red o backend caído: silencio */ });
  }, []);

  /**
   * Carga el estado actual del QR en Skyline (qué URL está proyectada).
   * Se vuelve a cargar al cambiar de campaña.
   */
  useEffect(() => {
    const campaignId = activeCampaign?.id;
    if (!campaignId) { setSkylineQrUrl(''); return; }
    getSkylineOverlaySettings(campaignId)
      .then((s) => setSkylineQrUrl(s.showQr ? (s.qrUrl ?? '') : ''))
      .catch(() => setSkylineQrUrl(''));
  }, [activeCampaign?.id]);

  /**
   * Envía (o quita) el QR de una URL a la ventana Skyline.
   * Persiste en backend y notifica mediante BroadcastChannel + localStorage.
   *
   * @param url - La URL que codifica el QR. Pasar cadena vacía para quitarlo.
   */
  const handleSkylineQrToggle = async (url: string) => {
    const campaignId = activeCampaign?.id;
    if (!campaignId) return;

    const sending = skylineQrUrl !== url; // Si ya está activa esa URL, la quitamos
    const nextShowQr = sending;
    const nextQrUrl = sending ? url : '';

    setSkylineQrUrl(nextQrUrl);
    try {
      await setSkylineOverlaySettings(campaignId, { showQr: nextShowQr, qrUrl: nextQrUrl });
      // Notify projection windows via BroadcastChannel
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('campaign-sync');
          bc.postMessage({
            type: 'skylineSettingsChanged',
            campaignId,
            settings: { showQr: nextShowQr, qrUrl: nextQrUrl },
          });
          bc.close();
        }
      } catch {}
      // Notify cross-tab via localStorage
      try {
        localStorage.setItem(
          'app.skyline.settingsUpdated',
          JSON.stringify({ campaignId, showQr: nextShowQr, qrUrl: nextQrUrl, at: Date.now() }),
        );
      } catch {}
    } catch {
      // Revert optimistic update on error
      setSkylineQrUrl(skylineQrUrl);
    }
  };

  /**
   * Copia la URL indicada al portapapeles y muestra confirmación.
   *
   * @param url - URL a copiar.
   */
  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopySuccess(true);
    }
  };
  const { mode, setMode, primary, setPrimary, secondary, setSecondary, background, setBackground } = useContext(ThemeContext);
  const handleChangeTheme = async (event: any) => {
    const newTheme = event.target.value;
    setMode(newTheme);
    localStorage.setItem('theme', newTheme);
    // Actualizar preferencia en backend
    try {
      const token = localStorage.getItem('access_token');
      await axios.patch(`${API_BASE_URL}/users/me/preferences`, { theme: newTheme }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {}
  };

  const handleChangeLanguage = async (event: any) => {
    const newLang = event.target.value;
    if (typeof i18n.changeLanguage === 'function') {
      i18n.changeLanguage(newLang);
    }
    localStorage.setItem('lang', newLang);
    // Actualizar preferencia en backend
    try {
      const token = localStorage.getItem('access_token');
      await axios.patch(`${API_BASE_URL}/users/me/preferences`, { language: newLang }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {}
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
        {/* ── Language & Theme (always visible) ──────────────── */}
        <FormControl fullWidth>
          <InputLabel id="language-select-label">{t('language')}</InputLabel>
          <Select
            labelId="language-select-label"
            value={i18n.language || localStorage.getItem('lang') || 'es'}
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

        {/* ── Acceso Web ─────────────────────────────────────── */}
        <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('web_access_title', 'Acceso web')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('web_access_description', 'Usa esta URL en cualquier navegador de tu red local para acceder a la app:')}
            </Typography>
            {webUrls.length === 0 && (
              <Typography variant="body2" color="text.disabled">
                {t('web_access_loading', 'Obteniendo IP de red...')}
              </Typography>
            )}
            <Stack spacing={1}>
              {webUrls.map((url) => (
                <Box key={url}>
                  <OutlinedInput
                    fullWidth
                    readOnly
                    value={url}
                    size="small"
                    sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                    endAdornment={
                      <InputAdornment position="end">
                        <Tooltip title={t('open_in_browser', 'Abrir en navegador')}>
                          <span>
                            <Button
                              size="small"
                              component="a"
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ minWidth: 0, p: 0.5 }}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('copy_url', 'Copiar URL')}>
                          <Button
                            size="small"
                            onClick={() => handleCopyUrl(url)}
                            sx={{ minWidth: 0, p: 0.5 }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </Button>
                        </Tooltip>
                        {activeCampaign && (
                          <Tooltip
                            title={
                              skylineQrUrl === url
                                ? t('qr_remove_from_skyline', 'Quitar QR de Skyline')
                                : t('qr_send_to_skyline', 'Mostrar QR en Skyline')
                            }
                          >
                            <IconButton
                              size="small"
                              color={skylineQrUrl === url ? 'warning' : 'default'}
                              onClick={() => handleSkylineQrToggle(url)}
                            >
                              {skylineQrUrl === url ? (
                                <TvOffIcon fontSize="small" />
                              ) : (
                                <TvIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                      </InputAdornment>
                    }
                  />
                  {/* QR code preview below the active URL */}
                  {skylineQrUrl === url && (
                    <Box
                      sx={{
                        mt: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.5,
                        p: 1.5,
                        bgcolor: 'white',
                        borderRadius: 1,
                        width: 'fit-content',
                        border: '1px solid',
                        borderColor: 'warning.main',
                      }}
                    >
                      <QRCodeSVG value={url} size={140} />
                      <Typography variant="caption" color="text.secondary" sx={{ color: 'black' }}>
                        {t('qr_on_skyline', 'Proyectando en Skyline')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* ── Skyline preview ────────────────────────────────── */}
        <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('skyline_preview_title', 'Previsualización Skyline')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t(
                'skyline_preview_description',
                'Muestra en la esquina inferior derecha una miniatura de las imágenes que se están proyectando en la ventana Skyline (personaje activo e ítems de tienda).',
              )}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={skylinePreview}
                  onChange={handleSkylinePreviewToggle}
                  color="primary"
                />
              }
              label={t('skyline_preview_enable', 'Activar previsualización Skyline')}
            />
          </AccordionDetails>
        </Accordion>

        {/* ── Sidebar shortcuts (collapsible) ────────────────── */}
        <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('sidebar_settings_title', 'Accesos directos del sidebar')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <SidebarSettings />
          </AccordionDetails>
        </Accordion>

        {/* ── Actualizaciones ─────────────────────────────────── */}
        <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('updater_section_title', 'Actualizaciones')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <UpdateChecker />
          </AccordionDetails>
        </Accordion>

        {/* ── Account settings (collapsible) ──────────────────── */}
        <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('account_settings', 'Ajustes de la cuenta')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Button variant="outlined" color="primary" onClick={() => navigate('/change-password')}>
                {t('change_password')}
              </Button>
              <Button variant="outlined" color="error" onClick={() => navigate('/delete-account')}>
                {t('delete_account')}
              </Button>
              <Button variant="outlined" color="secondary" onClick={handleLogout}>
                {t('logout')}
              </Button>
            </Stack>
          </AccordionDetails>
        </Accordion>
      </Stack>

      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
          {t('url_copied', 'URL copiada al portapapeles')}
        </Alert>
      </Snackbar>

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
