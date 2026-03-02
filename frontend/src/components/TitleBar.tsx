import { useContext, useEffect, useState, useCallback } from 'react';
import { darken, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MinimizeIcon from '@mui/icons-material/Remove';
import MaximizeIcon from '@mui/icons-material/CropSquare';
import RestoreIcon from '@mui/icons-material/FilterNone';
import CloseIcon from '@mui/icons-material/Close';
import ThemeContext from '../ThemeContext';

/**
 * Altura en píxeles de la barra de título custom.
 * Se exporta para que el layout pueda reservar este espacio.
 */
export const TITLEBAR_HEIGHT = 28;

/**
 * Barra de título personalizada para la ventana frameless de Electron.
 *
 * - Arrastrable para mover la ventana (`-webkit-app-region: drag`)
 * - Botones de minimizar, maximizar/restaurar y cerrar
 * - Fondo un tono más oscuro que el tema activo
 * - Se oculta automáticamente en rutas de proyección
 */
const TitleBar: React.FC = () => {
  const muiTheme = useTheme();
  const { mode } = useContext(ThemeContext);
  const isDark = mode === 'dark';

  const [isMaximized, setIsMaximized] = useState(false);

  // Consultar estado inicial de maximizado
  useEffect(() => {
    window.electronAPI?.windowIsMaximized?.().then(setIsMaximized).catch(() => {});
  }, []);

  // Escuchar cambios de estado maximizado
  useEffect(() => {
    const dispose = window.electronAPI?.onMaximizedChanged?.((val: boolean) => setIsMaximized(val));
    return () => { if (typeof dispose === 'function') dispose(); };
  }, []);

  const handleMinimize = useCallback(() => window.electronAPI?.windowMinimize?.(), []);
  const handleMaximize = useCallback(() => window.electronAPI?.windowMaximize?.(), []);
  const handleClose = useCallback(() => window.electronAPI?.windowClose?.(), []);

  // Color de fondo: tono más oscuro
  const bgColor = darken(muiTheme.palette.background.default, isDark ? 0.4 : 0.1);
  const textColor = isDark ? '#c0c0c0' : '#444444';
  const btnHover = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  // No renderizar en ventanas de proyección
  if (typeof window !== 'undefined' && window.location.hash?.startsWith('#/projection')) {
    return null;
  }

  return (
    <Box
      sx={{
        height: TITLEBAR_HEIGHT,
        minHeight: TITLEBAR_HEIGHT,
        maxHeight: TITLEBAR_HEIGHT,
        bgcolor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        zIndex: 9999,
        position: 'relative',
        width: '100%',
        flexShrink: 0,
      }}
    >
      {/* Título de la app */}
      <Typography
        sx={{
          fontSize: '0.72rem',
          fontWeight: 600,
          color: textColor,
          pl: 1.5,
          letterSpacing: 0.4,
          lineHeight: 1,
        }}
      >
        MasterHelp
      </Typography>

      {/* Botones de control de ventana */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          WebkitAppRegion: 'no-drag', // los botones no deben arrastrar
        }}
      >
        <IconButton
          size="small"
          onClick={handleMinimize}
          aria-label="Minimizar"
          disableRipple
          sx={{
            borderRadius: 0,
            p: 0,
            width: 40,
            height: TITLEBAR_HEIGHT,
            color: textColor,
            '&:hover': { bgcolor: btnHover },
          }}
        >
          <MinimizeIcon sx={{ fontSize: 14 }} />
        </IconButton>

        <IconButton
          size="small"
          onClick={handleMaximize}
          aria-label={isMaximized ? 'Restaurar' : 'Maximizar'}
          disableRipple
          sx={{
            borderRadius: 0,
            p: 0,
            width: 40,
            height: TITLEBAR_HEIGHT,
            color: textColor,
            '&:hover': { bgcolor: btnHover },
          }}
        >
          {isMaximized
            ? <RestoreIcon sx={{ fontSize: 12 }} />
            : <MaximizeIcon sx={{ fontSize: 12 }} />
          }
        </IconButton>

        <IconButton
          size="small"
          onClick={handleClose}
          aria-label="Cerrar"
          disableRipple
          sx={{
            borderRadius: 0,
            p: 0,
            width: 40,
            height: TITLEBAR_HEIGHT,
            color: textColor,
            '&:hover': { bgcolor: '#e81123', color: '#fff' },
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
    </Box>
  );
};

export default TitleBar;
