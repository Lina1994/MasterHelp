import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LockIcon from '@mui/icons-material/Lock';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { CardEntityKind, CardEntityPayload, CardTemplate, CardTemplateInput } from '../../types/cardTemplates';
import { CARD_SIZE_PRESETS } from '../../utils/cardSizes';
import CardPreview from './CardPreview';
import { CARD_STARTER_TEMPLATES } from '../../data/cardStarterTemplates';
import { inferKindFromSlots, useRealCardSample } from './sharedSampleCache';
import { entityNormalisers } from './cardsFieldCatalog';

/**
 * Renders user-owned template cards with quick actions.
 *
 * NOTE: each card opens the editor on click (previewing + exporting happens
 * inside the editor). Above the user templates we render a "Plantillas de
 * ejemplo" panel with the built-in starters (Magic, Pokémon-style and
 * Tarot). Each starter card has a single CTA that copies it into the
 * current user's library via `onUseStarter`.
 *
 * Each template card tries to fetch a real representative sample for the
 * inferred entity kind so the preview shows authentic content rather than
 * the static "Bola de fuego" placeholder.
 */
export default function CardTemplateList({
  templates,
  onCreate,
  onEdit,
  onDelete,
  onDuplicate,
  onUseStarter,
  isBusy = false,
}: {
  templates: CardTemplate[];
  onCreate: () => void;
  onEdit: (template: CardTemplate) => void;
  onDelete: (template: CardTemplate) => Promise<void> | void;
  onDuplicate: (template: CardTemplate) => Promise<void> | void;
  /** Adds a built-in starter to the user's library. */
  onUseStarter: (input: CardTemplateInput, label: string) => Promise<void> | void;
  isBusy?: boolean;
}) {
  const { t } = useTranslation();
  const [pendingDelete, setPendingDelete] = useState<CardTemplate | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<CardTemplate | null>(null);
  const [pendingStarter, setPendingStarter] = useState<{ input: CardTemplateInput; label: string } | null>(null);
  const [starterBusy, setStarterBusy] = useState<string | null>(null);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">{t('cards_templates_title', 'Plantillas de carta')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate} disabled={isBusy}>
          {t('cards_template_new', 'Nueva plantilla')}
        </Button>
      </Stack>

      {/* Built-in starter templates. Hidden when the user already has plenty of
          own templates so the surface stays compact for power users. */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <AutoAwesomeIcon fontSize="small" color="action" />
          <Typography variant="subtitle1">{t('cards_starter_section_title', 'Plantillas de ejemplo')}</Typography>
          <Chip size="small" label={t('cards_starter_section_chip', 'incluidas')} variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('cards_starter_section_hint', 'Duplica una plantilla lista para usar y personalízala a tu gusto.')}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {CARD_STARTER_TEMPLATES.map((starter) => (
            <Card key={starter.id} variant="outlined" sx={{ overflow: 'hidden' }}>
              <Box
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.default' : 'grey.100',
                  minHeight: 200,
                }}
              >
                <StarterCardPreview template={starter.template} />
              </Box>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>{starter.label}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {t(starter.descriptionI18nKey, starter.descriptionFallback)}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  <Chip size="small" label={`${starter.template.widthMm}×${starter.template.heightMm} mm`} />
                  <Chip size="small" label={presetLabel(t, starter.template.sizePreset)} variant="outlined" />
                  <Chip
                    size="small"
                    label={`${starter.template.slots.length} ${t('cards_slot_many', 'slots')}`}
                    variant="outlined"
                  />
                </Stack>
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 1.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<ContentCopyIcon />}
                  disabled={isBusy || starterBusy === starter.id}
                  onClick={() => setPendingStarter({ input: starter.input, label: starter.label })}
                >
                  {starterBusy === starter.id
                    ? t('cards_starter_duplicate_loading', 'Duplicando…')
                    : t('cards_starter_duplicate', 'Duplicar a mi biblioteca')}
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 2 }}>
        <Chip size="small" label={t('cards_my_templates', 'Mis plantillas')} />
      </Divider>

      {templates.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography variant="subtitle1" gutterBottom>
            {t('cards_templates_empty_title', 'Aún no has creado plantillas')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('cards_templates_empty_hint', 'Crea tu primera plantilla con un tamaño preestablecido y empieza a añadir texto, imágenes y separadores.')}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
            {t('cards_template_new', 'Nueva plantilla')}
          </Button>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {templates.map((template) => (
            <UserTemplateCard
              key={template.id}
              template={template}
              isBusy={isBusy}
              onEdit={onEdit}
              onDeleteClick={() => setPendingDelete(template)}
              onDuplicateClick={() => setPendingDuplicate(template)}
            />
          ))}
        </Box>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)}>
        <DialogTitle>{t('confirm_delete', '¿Confirmar eliminación?')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('cards_delete_template_confirm', '¿Eliminar la plantilla "{{name}}"?', { name: pendingDelete?.name ?? '' })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button color="error" onClick={async () => { if (pendingDelete) await onDelete(pendingDelete); setPendingDelete(null); }}>
            {t('delete', 'Eliminar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Duplicate (own template) confirmation */}
      <Dialog open={!!pendingDuplicate} onClose={() => setPendingDuplicate(null)}>
        <DialogTitle>{t('cards_duplicate_template_title', 'Duplicar plantilla')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('cards_duplicate_template_confirm', 'Se creará una copia de "{{name}}" llamada "{{name}} (Copia)".', {
              name: pendingDuplicate?.name ?? '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDuplicate(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={async () => { if (pendingDuplicate) await onDuplicate(pendingDuplicate); setPendingDuplicate(null); }}
          >
            {t('cards_action_duplicate', 'Duplicar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Use starter confirmation */}
      <Dialog open={!!pendingStarter} onClose={() => setPendingStarter(null)}>
        <DialogTitle>{t('cards_starter_duplicate_title', 'Añadir a tu biblioteca')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('cards_starter_duplicate_confirm', 'Se creará una copia de "{{label}}" lista para editar en tu biblioteca.', {
              label: pendingStarter?.label ?? '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingStarter(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!pendingStarter) return;
              setStarterBusy(`${pendingStarter.label}-${Date.now()}`);
              try {
                await onUseStarter(pendingStarter.input, pendingStarter.label);
              } finally {
                setStarterBusy(null);
                setPendingStarter(null);
              }
            }}
          >
            {t('cards_starter_duplicate', 'Duplicar a mi biblioteca')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Returns the localised preset label or the raw key when the preset is unknown. */
function presetLabel(t: TFunction, key: CardTemplate['sizePreset']): string {
  const preset = CARD_SIZE_PRESETS.find((p) => p.key === key);
  return preset?.label ?? key;
}

/** Sub-component: a single user-owned template card with lazy real-sample loading. */
function UserTemplateCard({
  template,
  isBusy,
  onEdit,
  onDeleteClick,
  onDuplicateClick,
}: {
  template: CardTemplate;
  isBusy: boolean;
  onEdit: (t: CardTemplate) => void;
  onDeleteClick: () => void;
  onDuplicateClick: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'es' = i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en';
  // Infer the most representative entity kind per template so we fetch the
  // right sample. `null` means every slot is static — no fetch needed.
  const inferredKind = useMemo<CardEntityKind | null>(() => inferKindFromSlots(template.slots ?? []), [template.slots]);
  const realSampleState = useRealCardSample(inferredKind, lang);
  const realSample = realSampleState.status === 'ok' ? realSampleState.payload : null;
  const fallbackSample = useMemo<CardEntityPayload>(
    () => entityNormalisers.spell({ id: 'sample', name: t('cards_sample_name', 'Bola de fuego'), description: t('cards_sample_description', 'Una bola de fuego abrasadora estalla...') } as any),
    [t],
  );
  const sampleEntity = realSample ?? fallbackSample;
  const lockedCount = (template.slots ?? []).filter((s) => s.locked).length;
  const slotCount = template.slots?.length ?? 0;

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden' }}>
      <CardActionArea onClick={() => onEdit(template)}>
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.default' : 'grey.100',
            minHeight: 220,
            position: 'relative',
          }}
        >
          <CardPreview template={template} sampleEntity={sampleEntity} maxWidthMm={60} />
          {realSample && (
            <Chip
              size="small"
              label={`${String(realSample.data?.name ?? '')}${inferredKind ? ` · ${inferredKind}` : ''}`}
              variant="outlined"
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                bgcolor: 'background.paper',
                fontSize: 10,
                pointerEvents: 'none',
              }}
            />
          )}
          {!realSample && realSampleState.status === 'loading' && (
            <Chip
              size="small"
              label={t('cards_loading_real_sample', 'Cargando ejemplo real…')}
              variant="outlined"
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                bgcolor: 'background.paper',
                fontSize: 10,
                pointerEvents: 'none',
              }}
            />
          )}
          {!realSample && realSampleState.status === 'error' && (
            <Chip
              size="small"
              color="warning"
              label={t('cards_sample_unavailable', 'No se pudo obtener un ejemplo real — mostrando el marcador integrado.')}
              variant="outlined"
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                bgcolor: 'background.paper',
                fontSize: 10,
                pointerEvents: 'none',
              }}
            />
          )}
        </Box>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom noWrap>
            {template.name}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
            <Chip size="small" label={`${template.widthMm}×${template.heightMm} mm`} />
            <Chip size="small" label={template.orientation === 'landscape' ? t('cards_orientation_landscape', 'Horizontal') : t('cards_orientation_portrait', 'Vertical')} />
            <Chip size="small" label={presetLabel(t, template.sizePreset)} variant="outlined" />
            <Chip
              size="small"
              label={`${slotCount} ${t('cards_slot_count', '{{count}} slot(s)', { count: slotCount })}`}
              variant="outlined"
            />
            {lockedCount > 0 && (
              <Chip
                size="small"
                icon={<LockIcon fontSize="small" />}
                label={t('cards_locked_count', '{{count}} locked', { count: lockedCount })}
                color="default"
                variant="outlined"
              />
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
      <CardActions sx={{ justifyContent: 'flex-end', px: 2 }}>
        <Tooltip title={t('cards_action_edit', 'Editar')}>
          <IconButton size="small" onClick={() => onEdit(template)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('cards_action_duplicate', 'Duplicar')}>
          <IconButton size="small" onClick={onDuplicateClick}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('delete', 'Eliminar')}>
          <IconButton size="small" color="error" onClick={onDeleteClick} disabled={isBusy}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

/** Sub-component: a starter card preview. Mirrors the user-card sample loading for consistency. */
function StarterCardPreview({ template }: { template: CardTemplate }) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'es' = i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en';
  const inferredKind = useMemo<CardEntityKind | null>(() => inferKindFromSlots(template.slots ?? []), [template.slots]);
  const realSampleState = useRealCardSample(inferredKind, lang);
  const realSample = realSampleState.status === 'ok' ? realSampleState.payload : null;
  const fallbackSample = useMemo<CardEntityPayload>(
    () => entityNormalisers.spell({
      id: 'sample',
      name: t('cards_sample_name', 'Bola de fuego'),
      description: t('cards_sample_description', 'Una bola de fuego abrasadora estalla...'),
      level: 3, school: 'Evocación', castingTime: '1 acción', range: '45 m', duration: 'Instantáneo', components: 'V, S, M',
    } as any),
    [t],
  );
  return <CardPreview template={template} sampleEntity={realSample ?? fallbackSample} maxWidthMm={60} />;
}
