import { Avatar, Box, Button, Tooltip, Typography, alpha } from '@mui/material';
import type { ShortcutItem } from '../../types/shortcuts';

interface ShortcutButtonProps {
  shortcut: ShortcutItem;
  onClick: (shortcut: ShortcutItem) => void;
  compact?: boolean;
  sidebarMinimal?: boolean;
  hotbar?: boolean;
  slotLabel?: string;
}

/**
 * Shared visual button used by the shortcuts page and shell surfaces.
 */
const ShortcutButton = ({
  shortcut,
  onClick,
  compact = false,
  sidebarMinimal = false,
  hotbar = false,
  slotLabel,
}: ShortcutButtonProps) => {
  const background = shortcut.isActive
    ? shortcut.activeColor || '#2e7d32'
    : shortcut.inactiveColor || '#455a64';

  const iconSize = hotbar ? 30 : (sidebarMinimal ? 22 : 34);

  const button = (
    <Button
      variant="contained"
      onClick={() => onClick(shortcut)}
      sx={{
        minWidth: hotbar ? 56 : (sidebarMinimal ? 44 : (compact ? 0 : 140)),
        width: hotbar ? 56 : (sidebarMinimal ? 44 : (compact ? '100%' : 'auto')),
        minHeight: hotbar ? 56 : (sidebarMinimal ? 44 : (compact ? 72 : 88)),
        px: hotbar ? 0.25 : (sidebarMinimal ? 0.25 : (compact ? 1 : 1.5)),
        py: hotbar ? 0.25 : (sidebarMinimal ? 0.25 : (compact ? 1 : 1.25)),
        borderRadius: hotbar ? 1.5 : (sidebarMinimal ? 1.2 : 2),
        bgcolor: background,
        color: '#fff',
        justifyContent: (sidebarMinimal || hotbar) ? 'center' : 'flex-start',
        boxShadow: hotbar ? 'inset 0 1px 0 rgba(255,255,255,0.16)' : 'none',
        border: hotbar ? '1px solid rgba(255,255,255,0.24)' : 'none',
        textTransform: 'none',
        '&:hover': {
          bgcolor: alpha(background, 0.88),
          boxShadow: hotbar ? '0 0 0 2px rgba(255,255,255,0.24)' : 'none',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: (sidebarMinimal || hotbar) ? 0 : 1, width: '100%', justifyContent: (sidebarMinimal || hotbar) ? 'center' : 'flex-start', position: 'relative' }}>
        {shortcut.imageUrl ? (
          <Avatar src={shortcut.imageUrl} alt={shortcut.name} sx={{ width: iconSize, height: iconSize }} />
        ) : (
          <Avatar sx={{ width: iconSize, height: iconSize, bgcolor: 'rgba(255,255,255,0.18)', fontSize: hotbar ? 15 : (sidebarMinimal ? 12 : 14) }}>
            {shortcut.icon || shortcut.name.slice(0, 1).toUpperCase()}
          </Avatar>
        )}
        {!sidebarMinimal && !hotbar ? (
          <Box sx={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.15 }} noWrap>
              {shortcut.name}
            </Typography>
            {shortcut.hotkey ? (
              <Typography variant="caption" sx={{ opacity: 0.86 }} noWrap>
                {shortcut.hotkey}
              </Typography>
            ) : null}
          </Box>
        ) : null}
        {hotbar && slotLabel ? (
          <Box
            sx={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              bgcolor: 'rgba(0,0,0,0.72)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 0.75,
              px: 0.35,
              py: 0.05,
              lineHeight: 1,
            }}
          >
            <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
              {slotLabel}
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Button>
  );

  if (!sidebarMinimal && !hotbar) return button;

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {shortcut.name}
          </Typography>
          {shortcut.hotkey ? (
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {shortcut.hotkey}
            </Typography>
          ) : null}
        </Box>
      }
      arrow
      placement={hotbar ? 'top' : 'right'}
    >
      <Box>{button}</Box>
    </Tooltip>
  );
};

export default ShortcutButton;