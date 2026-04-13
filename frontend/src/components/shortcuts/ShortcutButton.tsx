import { Avatar, Box, Button, Tooltip, Typography, alpha } from '@mui/material';
import type { ShortcutItem } from '../../types/shortcuts';

interface ShortcutButtonProps {
  shortcut: ShortcutItem;
  onClick: (shortcut: ShortcutItem) => void;
  compact?: boolean;
  sidebarMinimal?: boolean;
}

/**
 * Shared visual button used by the shortcuts page and shell surfaces.
 */
const ShortcutButton = ({ shortcut, onClick, compact = false, sidebarMinimal = false }: ShortcutButtonProps) => {
  const background = shortcut.isActive
    ? shortcut.activeColor || '#2e7d32'
    : shortcut.inactiveColor || '#455a64';

  const button = (
    <Button
      variant="contained"
      onClick={() => onClick(shortcut)}
      sx={{
        minWidth: sidebarMinimal ? 44 : (compact ? 0 : 140),
        width: sidebarMinimal ? 44 : (compact ? '100%' : 'auto'),
        minHeight: sidebarMinimal ? 44 : (compact ? 72 : 88),
        px: sidebarMinimal ? 0.25 : (compact ? 1 : 1.5),
        py: sidebarMinimal ? 0.25 : (compact ? 1 : 1.25),
        borderRadius: sidebarMinimal ? 1.2 : 2,
        bgcolor: background,
        color: '#fff',
        justifyContent: sidebarMinimal ? 'center' : 'flex-start',
        boxShadow: 'none',
        textTransform: 'none',
        '&:hover': {
          bgcolor: alpha(background, 0.88),
          boxShadow: 'none',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: sidebarMinimal ? 0 : 1, width: '100%', justifyContent: sidebarMinimal ? 'center' : 'flex-start' }}>
        {shortcut.imageUrl ? (
          <Avatar src={shortcut.imageUrl} alt={shortcut.name} sx={{ width: sidebarMinimal ? 22 : 34, height: sidebarMinimal ? 22 : 34 }} />
        ) : (
          <Avatar sx={{ width: sidebarMinimal ? 22 : 34, height: sidebarMinimal ? 22 : 34, bgcolor: 'rgba(255,255,255,0.18)', fontSize: sidebarMinimal ? 12 : 14 }}>
            {shortcut.icon || shortcut.name.slice(0, 1).toUpperCase()}
          </Avatar>
        )}
        {!sidebarMinimal ? (
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
      </Box>
    </Button>
  );

  if (!sidebarMinimal) return button;

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
      placement="right"
    >
      <Box>{button}</Box>
    </Tooltip>
  );
};

export default ShortcutButton;