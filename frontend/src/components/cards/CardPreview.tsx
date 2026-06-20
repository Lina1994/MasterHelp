import { Box, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import CardRenderer from './CardRenderer';
import LiveSlotOverlay from './LiveSlotOverlay';
import type { CardEntityPayload, CardTemplate } from '../../types/cardTemplates';
import { entityNormalisers } from './cardsFieldCatalog';

const MM_TO_PX = 96 / 25.4;

/**
 * On-screen preview of a template applied to a sample entity. The preview
 * scales the card to fit the available width so the user can see it at any
 * zoom level without overwhelming the dialog.
 *
 * When `interactive` is true a {@link LiveSlotOverlay} sits on top of the
 * renderer so the editor can drag/resize slots visually. If `sampleEntity`
 * is omitted we fabricate a minimal one derived from the first binding in
 * the template so the slots render against real data.
 *
 * `zoom` lets the editor give the user a bigger canvas: it multiplies the
 * base fit-to-window scale. The PX-to-MM conversion inside
 * {@link LiveSlotOverlay} keeps working untouched because the outer box
 * (which the overlay's `rect.width` reads) is sized at the final display
 * scale — not at the natural card pixel size.
 */
export default function CardPreview({
  template,
  sampleEntity,
  maxWidthMm = 220,
  emptyMessage,
  interactive = false,
  selectedSlotId = null,
  onSelectSlot,
  onSlotsChange,
  zoom = 1,
  showLabels = false,
}: {
  template: CardTemplate;
  sampleEntity?: CardEntityPayload | null;
  maxWidthMm?: number;
  emptyMessage?: string;
  interactive?: boolean;
  selectedSlotId?: string | null;
  onSelectSlot?: (id: string | null) => void;
  onSlotsChange?: (next: CardTemplate['slots']) => void;
  /** Multiplier on top of the base fit-to-window scale. Must be > 0. */
  zoom?: number;
  /** Forwarded to {@link LiveSlotOverlay} so the parent can decide. */
  showLabels?: boolean;
}) {
  const { t } = useTranslation();
  const target = useMemo<CardEntityPayload | null>(() => {
    if (sampleEntity) return sampleEntity;
    if (template.slots.length === 0) return null;
    const firstField = template.slots.map((s) => s.binding?.fieldPath).find((p) => !!p);
    const kind: CardEntityPayload['kind'] = firstField?.startsWith('prerequisite')
      ? 'feat'
      : firstField?.startsWith('abilities') || firstField?.startsWith('armorClass') || firstField?.startsWith('hitPoints')
        ? 'monster'
        : firstField?.startsWith('className') || firstField?.startsWith('dexterity')
          ? 'character'
          : firstField?.startsWith('price')
            ? 'shop-item'
            : 'spell';
    return entityNormalisers[kind]({
      id: 'sample',
      name: t('cards_sample_name', 'Bola de fuego'),
      description: t('cards_sample_description', 'Una bola de fuego abrasadora estalla desde un punto a elección dentro del alcance, expandiéndose para llenar una esfera de 6 metros de radio...'),
      origin: 'manual',
      level: 3,
      school: 'Evocación',
      castingTime: '1 acción',
      range: '45 m',
      duration: 'Instantáneo',
      components: 'V, S, M',
    } as any);
  }, [sampleEntity, template.slots, t]);

  if (!target) {
    return (
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Stack alignItems="center" spacing={1}>
          <Typography variant="subtitle1" color="text.secondary">
            {emptyMessage ?? t('cards_preview_empty', 'Añade al menos un slot para ver la previsualización.')}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  // Single source of truth for the display scale. Combining the base
  // fit-to-window scale with the user zoom keeps the px→mm conversion in
  // LiveSlotOverlay's drag handlers automatically accurate: the overlay's
  // container ref is sized at the *final* on-screen dimensions.
  const pxScale = MM_TO_PX;
  const pxW = template.widthMm * pxScale;
  const pxH = template.heightMm * pxScale;
  const maxScreenPx = Math.max(160, maxWidthMm * pxScale); // never smaller than a thumb
  const fitScale = Math.min(1, maxScreenPx / pxW);
  // Defensive clamp so a stray `zoom = -2` doesn't flip the card.
  const safeZoom = Math.max(0.25, zoom);
  const displayScale = fitScale * safeZoom;

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.default' : 'grey.100',
        display: 'flex',
        // `safe center` keeps the card centred when it fits and falls back
        // to flex-start when it overflows — otherwise the user can't
        // scroll up to see the top of an enlarged card.
        justifyContent: 'safe center',
        alignItems: 'safe center',
        minHeight: 200,
        overflow: 'auto',
      }}
    >
      <Box sx={{ position: 'relative', width: pxW * displayScale, height: pxH * displayScale }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `scale(${displayScale})`,
            transformOrigin: 'top left',
            width: pxW,
            height: pxH,
          }}
        >
          <CardRenderer template={template} entity={target} />
          {interactive && onSelectSlot && onSlotsChange && (
            <LiveSlotOverlay
              template={template}
              selectedSlotId={selectedSlotId}
              onSelectSlot={onSelectSlot}
              onSlotsChange={onSlotsChange}
              showLabels={showLabels}
            />
          )}
        </Box>
      </Box>
    </Paper>
  );
}
