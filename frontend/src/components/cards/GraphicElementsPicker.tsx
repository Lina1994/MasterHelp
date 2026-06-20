import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import {
  CARD_GRAPHIC_CATALOG,
  type CardGraphicElement,
} from '../../data/cardGraphicElements';

/**
 * Modal that lets the editor insert pre-made SVG ornaments directly onto
 * the canvas as IMAGE slots. The picker is intentionally small: each
 * element shows its real proportions in a thumbnail so the user can gauge
 * how it will look once dropped onto the card.
 *
 * Clicking an element calls `onPick(element)` and closes the dialog so
 * the parent can append a slot to the template's `slots` array.
 */
export default function GraphicElementsPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (element: CardGraphicElement) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon fontSize="small" color="primary" />
        {t('cards_graphic_picker_title', 'Elementos gráficos')}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'cards_graphic_picker_hint',
            'Pulsa un elemento para insertarlo como slot de imagen. Puedes recolocarlo y redimensionarlo como cualquier otro.',
          )}
        </Typography>
        <Stack spacing={3}>
          {CARD_GRAPHIC_CATALOG.map((group) => (
            <Box key={group.labelI18nKey}>
              <Typography variant="overline" color="text.secondary">
                {t(group.labelI18nKey, group.labelI18nKey.replace(/^cards_graphic_group_/, ''))}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 1.5,
                  mt: 0.5,
                }}
              >
                {group.items.map((element) => (
                  <Button
                    key={element.id}
                    variant="outlined"
                    onClick={() => {
                      onPick(element);
                      onClose();
                    }}
                    sx={{
                      p: 1.5,
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                      textTransform: 'none',
                      borderRadius: 1.5,
                      color: 'text.primary',
                      '& img': { maxWidth: '100%' },
                    }}
                  >
                    <Box
                      sx={{
                        // Force the thumbnail to keep native aspect ratio
                        // by computing its aspect from `defaultSizeMm`.
                        aspectRatio: `${element.defaultSizeMm.w} / ${element.defaultSizeMm.h}`,
                        width: '100%',
                        maxHeight: 70,
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={element.dataUri}
                        alt={t(element.labelI18nKey, element.id)}
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {t(element.labelI18nKey, element.id)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {element.defaultSizeMm.w}×{element.defaultSizeMm.h} mm
                    </Typography>
                  </Button>
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel', 'Cancelar')}</Button>
      </DialogActions>
    </Dialog>
  );
}
