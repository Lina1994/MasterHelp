import React, { useEffect, useState } from 'react';
import {
  Box, Button, Typography, LinearProgress, Alert, Stack, Chip,
} from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useTranslation } from 'react-i18next';

type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateInfo {
  version?: string;
  releaseDate?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
}

/**
 * Componente que permite al usuario comprobar si hay actualizaciones
 * de la aplicación y descargarlas/instalarlas sin salir de la app.
 *
 * Solo funciona en entorno Electron (cuando `window.electronAPI` está disponible
 * con las APIs de updater).  En web/dev se muestra un aviso de no disponible.
 */
const UpdateChecker: React.FC = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({});
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const api = window.electronAPI;
  const isElectron = !!(api?.updaterCheck);

  useEffect(() => {
    if (!isElectron) return;

    const cleanups: Array<() => void> = [];

    cleanups.push(api.onUpdaterChecking!(() => setState('checking')));

    cleanups.push(api.onUpdaterAvailable!((info) => {
      setState('available');
      setUpdateInfo({ version: info.version, releaseDate: info.releaseDate });
    }));

    cleanups.push(api.onUpdaterNotAvailable!((info) => {
      setState('not-available');
      setUpdateInfo({ version: info.version });
    }));

    cleanups.push(api.onUpdaterProgress!((p) => {
      setState('downloading');
      setProgress({ percent: p.percent, bytesPerSecond: p.bytesPerSecond });
    }));

    cleanups.push(api.onUpdaterDownloaded!((info) => {
      setState('downloaded');
      setUpdateInfo((prev) => ({ ...prev, version: info.version }));
      setProgress(null);
    }));

    cleanups.push(api.onUpdaterError!((err) => {
      setState('error');
      setErrorMsg(err.message);
    }));

    return () => cleanups.forEach((fn) => fn());
  }, [isElectron]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Dispara la comprobación de actualizaciones via IPC.
   */
  const handleCheck = async () => {
    setErrorMsg('');
    setState('checking');
    const result = await api!.updaterCheck!();
    if (!result.ok && result.error === 'dev-mode') {
      setState('error');
      setErrorMsg(t('updater_dev_mode', 'Las actualizaciones solo están disponibles en la versión instalada de la app.'));
    }
    // El resto se gestiona via los listeners de eventos
  };

  /**
   * Inicia la descarga de la actualización disponible.
   */
  const handleDownload = async () => {
    setState('downloading');
    setProgress({ percent: 0, bytesPerSecond: 0 });
    const result = await api!.updaterDownload!();
    if (!result.ok) {
      setState('error');
      setErrorMsg(result.error ?? t('updater_download_error', 'Error al descargar la actualización.'));
    }
  };

  /**
   * Cierra la app e instala la actualización descargada.
   */
  const handleInstall = () => {
    api!.updaterInstall!();
  };

  if (!isElectron) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('updater_not_available', 'Las actualizaciones automáticas solo están disponibles en la aplicación de escritorio.')}
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('updater_description', 'Comprueba si hay una nueva versión de MasterHelp disponible y descárgala directamente desde aquí.')}
      </Typography>

      {/* Estado: idle / not-available */}
      {(state === 'idle' || state === 'not-available') && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<SystemUpdateAltIcon />}
            onClick={handleCheck}
          >
            {t('updater_check_button', 'Comprobar actualizaciones')}
          </Button>
          {state === 'not-available' && (
            <Chip
              icon={<CheckCircleOutlineIcon />}
              label={t('updater_up_to_date', 'La app está actualizada') + (updateInfo.version ? ` (v${updateInfo.version})` : '')}
              color="success"
              variant="outlined"
              size="small"
            />
          )}
        </Box>
      )}

      {/* Estado: comprobando */}
      {state === 'checking' && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('updater_checking', 'Comprobando actualizaciones...')}
          </Typography>
          <LinearProgress />
        </Box>
      )}

      {/* Estado: actualización disponible */}
      {state === 'available' && (
        <Box>
          <Alert severity="info" sx={{ mb: 1.5 }}>
            {t('updater_available', 'Hay una nueva versión disponible:')} <strong>v{updateInfo.version}</strong>
            {updateInfo.releaseDate && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                {new Date(updateInfo.releaseDate).toLocaleDateString()}
              </Typography>
            )}
          </Alert>
          <Button variant="contained" color="primary" startIcon={<SystemUpdateAltIcon />} onClick={handleDownload}>
            {t('updater_download_button', 'Descargar actualización')}
          </Button>
        </Box>
      )}

      {/* Estado: descargando */}
      {state === 'downloading' && progress && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {t('updater_downloading', 'Descargando')}… {Math.round(progress.percent)}%
            {progress.bytesPerSecond > 0 && (
              <> ({(progress.bytesPerSecond / 1024).toFixed(0)} KB/s)</>
            )}
          </Typography>
          <LinearProgress variant="determinate" value={progress.percent} />
        </Box>
      )}

      {/* Estado: descarga completada */}
      {state === 'downloaded' && (
        <Box>
          <Alert severity="success" sx={{ mb: 1.5 }}>
            {t('updater_downloaded', 'Actualización descargada')}
            {updateInfo.version && <> (v{updateInfo.version})</>}.{' '}
            {t('updater_install_hint', 'Pulsa instalar para cerrar la app y aplicar la actualización.')}
          </Alert>
          <Button variant="contained" color="success" onClick={handleInstall}>
            {t('updater_install_button', 'Instalar y reiniciar')}
          </Button>
        </Box>
      )}

      {/* Estado: error */}
      {state === 'error' && (
        <Box>
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {errorMsg || t('updater_error', 'Error desconocido al comprobar actualizaciones.')}
          </Alert>
          <Button variant="outlined" onClick={handleCheck}>
            {t('updater_retry', 'Reintentar')}
          </Button>
        </Box>
      )}
    </Stack>
  );
};

export default UpdateChecker;
