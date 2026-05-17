import { Avatar, Paper, Stack, Typography } from '@mui/material';

type ShortcutThumbnailPreviewProps = {
  icon?: string | null;
  imageUrl?: string | null;
  name: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  hideLabel?: boolean;
};

/**
 * Compact thumbnail preview used by the shortcut editor header.
 */
const ShortcutThumbnailPreview = ({ icon, imageUrl, name, onClick, hideLabel }: ShortcutThumbnailPreviewProps) => {
  const fallbackLabel = name.trim().slice(0, 1).toUpperCase() || '?';
  const statusLabel = imageUrl ? 'Imagen/GIF' : icon ? 'Emoji' : 'Sin miniatura';

  return (
    <Stack spacing={1} alignItems="flex-start">
      <Paper
        component="button"
        type="button"
        onClick={onClick}
        variant="outlined"
        sx={{
          width: 108,
          height: 108,
          p: 1,
          borderRadius: 3,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: imageUrl || icon ? 'action.hover' : 'background.default',
          borderStyle: imageUrl || icon ? 'solid' : 'dashed',
          transition: 'border-color 120ms ease, background-color 120ms ease, transform 120ms ease',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.selected',
            transform: 'translateY(-1px)',
          },
        }}
      >
        {imageUrl ? (
          <Avatar src={imageUrl} alt={name} variant="rounded" sx={{ width: '100%', height: '100%', borderRadius: 2 }} />
        ) : (
          <Avatar
            variant="rounded"
            sx={{
              width: '100%',
              height: '100%',
              borderRadius: 2,
              bgcolor: icon ? 'rgba(255,255,255,0.18)' : 'action.hover',
              color: 'text.primary',
              fontSize: icon ? 34 : 28,
              fontWeight: 700,
            }}
          >
            {icon || fallbackLabel}
          </Avatar>
        )}
      </Paper>
      {!hideLabel && (
        <Typography variant="caption" color="text.secondary">
          {statusLabel} · Pulsa para editar
        </Typography>
      )}
    </Stack>
  );
};

export default ShortcutThumbnailPreview;