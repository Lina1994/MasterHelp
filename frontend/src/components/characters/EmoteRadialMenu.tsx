import React from 'react';
import { Popover, Box, IconButton, Avatar, Tooltip, PopoverOrigin } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface Emote {
  url: string;
  name?: string;
  isDefault: boolean;
}

interface EmoteRadialMenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  emotes: Emote[];
  onSelectEmote: (url: string) => void;
  /**
   * URL of the emote currently active in the Skyline for this character.
   * When provided, the matching emote is highlighted; otherwise the default
   * emote is highlighted as a fallback.
   */
  activeUrl?: string | null;
  /**
   * Where the popover attaches to the anchor element. Defaults to centering
   * the radial menu on the anchor. Override it when the anchor sits near a
   * screen edge (e.g. the Skyline preview overlay) to open the menu away from
   * sibling controls.
   */
  anchorOrigin?: PopoverOrigin;
  /** Origin point of the popover content. Pair with {@link anchorOrigin}. */
  transformOrigin?: PopoverOrigin;
  /**
   * Stacking order for the popover. Override it when rendering above other
   * high z-index layers (the Skyline preview overlay uses zIndex 1400).
   */
  zIndex?: number;
}

const CENTERED_ORIGIN: PopoverOrigin = { vertical: 'center', horizontal: 'center' };

export const EmoteRadialMenu: React.FC<EmoteRadialMenuProps> = ({
  open,
  anchorEl,
  onClose,
  emotes,
  onSelectEmote,
  activeUrl = null,
  anchorOrigin = CENTERED_ORIGIN,
  transformOrigin = CENTERED_ORIGIN,
  zIndex,
}) => {
  const R = 80; // Radio del círculo en px
  const size = 200; // Tamaño del contenedor en px
  const center = size / 2; // Coordenadas del centro

  // Filtrar emotes válidos que tengan url
  const validEmotes = emotes.filter((e) => e.url);
  const count = validEmotes.length;

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      sx={zIndex !== undefined ? { zIndex } : undefined}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
            pointerEvents: 'auto',
          },
        },
      }}
    >
      <Box
        sx={{
          width: size,
          height: size,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'emoteRadialOpen 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          '@keyframes emoteRadialOpen': {
            '0%': {
              opacity: 0,
              transform: 'scale(0.3) rotate(-30deg)',
            },
            '100%': {
              opacity: 1,
              transform: 'scale(1) rotate(0deg)',
            },
          },
        }}
      >
        {/* Fondo circular con efecto de cristal (glassmorphism) */}
        <Box
          sx={{
            position: 'absolute',
            width: size - 20,
            height: size - 20,
            borderRadius: '50%',
            bgcolor: 'rgba(18, 18, 18, 0.75)',
            backdropFilter: 'blur(8px)',
            border: '2px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none',
          }}
        />

        {/* Botón Central para Cerrar */}
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          sx={{
            position: 'absolute',
            zIndex: 10,
            width: 38,
            height: 38,
            bgcolor: 'rgba(255, 255, 255, 0.08)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: 2,
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: 'rgba(255, 0, 0, 0.75)',
              transform: 'scale(1.1) rotate(90deg)',
              borderColor: 'transparent',
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        {/* Elementos Radial Emotes */}
        {validEmotes.map((emote, idx) => {
          // Calcular el ángulo en radianes para posicionar de forma uniforme.
          // Empezamos en -90 grados (arriba del todo).
          const angle = -90 + idx * (360 / count);
          const rad = (angle * Math.PI) / 180;
          
          // Calcular las coordenadas x e y respecto al centro.
          const x = center + R * Math.cos(rad) - 24; // 24 es la mitad del tamaño del avatar (48px)
          const y = center + R * Math.sin(rad) - 24;

          const label = emote.name || `Emote ${idx + 1}`;
          // The active emote is the one currently shown in the Skyline. When no
          // active override is known, fall back to highlighting the default.
          const isActive = activeUrl ? emote.url === activeUrl : emote.isDefault;

          return (
            <Tooltip
              key={idx}
              title={`${label}${isActive ? ' (Activo)' : ''}`}
              arrow
              placement="top"
            >
              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEmote(emote.url);
                  onClose();
                }}
                sx={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  zIndex: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  boxShadow: 4,
                  border: isActive ? '2.5px solid #ffb300' : '2px solid rgba(255, 255, 255, 0.5)',
                  '&:hover': {
                    transform: 'scale(1.22)',
                    zIndex: 8,
                    borderColor: 'primary.main',
                    boxShadow: '0 0 14px 4px rgba(0, 229, 255, 0.4)',
                  },
                  '&:active': {
                    transform: 'scale(0.9)',
                  },
                }}
              >
                <Avatar
                  src={emote.url}
                  alt={label}
                  sx={{
                    width: '100%',
                    height: '100%',
                    bgcolor: 'background.paper',
                  }}
                />
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Popover>
  );
};
