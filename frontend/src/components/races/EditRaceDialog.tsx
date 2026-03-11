import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete, Box, Chip, createFilterOptions,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, IconButton, Typography, FormControl, InputLabel, Select, MenuItem,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { CampaignRaceDetail } from '../../api/races/racesApi';
import { listCampaignTraits, type CampaignTraitListItem } from '../../api/traits/traitsApi';

/** A racial trait entry stored in editor state — preserves description alongside the name. */
interface RaceTraitEntry {
  name: string;
  description?: string;
}

/** Option shape for the trait autocomplete. */
interface TraitOption {
  label: string;
  description?: string;
  isCustom?: boolean;
}

const filterTraitOptions = createFilterOptions<TraitOption>({
  matchFrom: 'any',
  stringify: (opt) => opt.label,
});

interface EditRaceDialogProps {
  open: boolean;
  raceData: CampaignRaceDetail | null;
  isCreate?: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  /** Campaign ID used to fetch the trait catalogue. */
  campaignId?: string | null;
}

const SIZE_OPTIONS = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

/**
 * Dialog for creating/editing a campaign race.
 * Supports assigning racial traits by picking from the campaign catalogue or typing freely.
 */
export default function EditRaceDialog({ open, raceData, isCreate = false, onClose, onSave, campaignId }: EditRaceDialogProps) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState('');
  const [size, setSize] = useState('Medium');
  const [walkSpeed, setWalkSpeed] = useState(30);
  const [languages, setLanguages] = useState('');
  const [customOriginName, setCustomOriginName] = useState('');
  const [traits, setTraits] = useState<RaceTraitEntry[]>([]);
  const [catalogueTraits, setCatalogueTraits] = useState<CampaignTraitListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── fetch campaign traits once when dialog opens ── */
  useEffect(() => {
    if (!open || !campaignId) return;
    let cancelled = false;
    const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';
    listCampaignTraits(campaignId, { pageSize: 9999, sort: 'name' }, lang)
      .then((res) => { if (!cancelled) setCatalogueTraits(res.items ?? []); })
      .catch(() => { if (!cancelled) setCatalogueTraits([]); });
    return () => { cancelled = true; };
  }, [open, campaignId, i18n.language]);

  const traitOptions: TraitOption[] = useMemo(
    () => catalogueTraits.map((tr) => ({ label: tr.name, description: tr.description })),
    [catalogueTraits],
  );

  const selectedTraitOptions: TraitOption[] = useMemo(
    () =>
      traits.map((entry) => {
        const found = traitOptions.find((o) => o.label.toLowerCase() === entry.name.toLowerCase());
        return found ?? { label: entry.name, description: entry.description, isCustom: true };
      }),
    [traits, traitOptions],
  );

  useEffect(() => {
    if (open) {
      if (raceData) {
        setName(raceData.name || '');
        setSize(raceData.size || 'Medium');
        setWalkSpeed(raceData.speed?.walk || 30);
        setLanguages((raceData.languages || []).join(', '));
        setCustomOriginName(raceData.customOriginName || '');
        setTraits(
          (raceData.traits || []).map((tr: any) => ({
            name: tr.name || '',
            description: tr.description ?? undefined,
          })),
        );
      } else {
        setName('');
        setSize('Medium');
        setWalkSpeed(30);
        setLanguages('');
        setCustomOriginName('');
        setTraits([]);
      }
      setError(null);
    }
  }, [open, raceData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        customData: {
          name,
          size,
          speed: { walk: walkSpeed },
          languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
          traits: traits
            .filter((tr) => tr.name.trim())
            .map((tr, idx) => ({
              id: `trait-${tr.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${idx}`,
              name: tr.name,
              ...(tr.description ? { description: tr.description } : {}),
            })),
        },
      };
      if (isCreate) {
        payload.customOriginName = customOriginName || 'Homebrew';
      } else if (customOriginName) {
        payload.customOriginName = customOriginName;
      }
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {isCreate ? t('new_race', 'Nueva Raza') : t('edit_race', 'Editar Raza')}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} columns={12} sx={{ mt: 0 }}>
          <Grid size={12}>
            <TextField label={t('name', 'Nombre')} value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          </Grid>
          <Grid size={6}>
            <FormControl fullWidth>
              <InputLabel>{t('size', 'Tamaño')}</InputLabel>
              <Select value={size} label={t('size', 'Tamaño')} onChange={(e) => setSize(e.target.value)}>
                {SIZE_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={6}>
            <TextField
              label={t('walk_speed', 'Velocidad (pies)')}
              type="number"
              value={walkSpeed}
              onChange={(e) => setWalkSpeed(Number(e.target.value))}
              fullWidth
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('languages', 'Idiomas')}
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              fullWidth
              helperText={t('comma_separated', 'Separados por coma (ej: Common, Elvish)')}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t('custom_origin', 'Nombre de origen')}
              value={customOriginName}
              onChange={(e) => setCustomOriginName(e.target.value)}
              fullWidth
              placeholder="Homebrew"
            />
          </Grid>

          {/* ── Racial Traits Autocomplete ── */}
          <Grid size={12}>
            <Autocomplete<TraitOption, true, false, true>
              multiple
              freeSolo
              forcePopupIcon
              openOnFocus
              size="small"
              options={traitOptions}
              value={selectedTraitOptions}
              getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label)}
              isOptionEqualToValue={(opt, val) =>
                opt.label.toLowerCase() === val.label.toLowerCase()
              }
              filterOptions={(opts, state) => {
                const filtered = filterTraitOptions(opts, state);
                if (
                  state.inputValue &&
                  !filtered.some(
                    (o) => o.label.toLowerCase() === state.inputValue.toLowerCase(),
                  )
                ) {
                  filtered.push({ label: state.inputValue, isCustom: true });
                }
                return filtered;
              }}
              onChange={(_e, newValue) => {
                setTraits(
                  newValue.map((v): RaceTraitEntry =>
                    typeof v === 'string'
                      ? { name: v }
                      : { name: v.label, description: v.description },
                  ),
                );
              }}
              renderOption={(props, option) => {
                const { key, ...rest } = props as any;
                const content = (
                  <Box
                    component="li"
                    key={key ?? option.label}
                    {...rest}
                    sx={{ display: 'flex', gap: 1 }}
                  >
                    <Typography variant="body2">
                      {option.isCustom ? `+ "${option.label}"` : option.label}
                    </Typography>
                  </Box>
                );
                if (option.description && !option.isCustom) {
                  return (
                    <Tooltip
                      key={key ?? option.label}
                      title={
                        option.description.length > 200
                          ? option.description.slice(0, 200) + '…'
                          : option.description
                      }
                      placement="right"
                      arrow
                    >
                      {content}
                    </Tooltip>
                  );
                }
                return content;
              }}
              renderTags={(tagValues, getTagProps) =>
                tagValues.map((option, idx) => {
                  const { key, ...rest } = getTagProps({ index: idx });
                  const label = typeof option === 'string' ? option : option.label;
                  return <Chip key={key} size="small" label={label} {...rest} />;
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('racial_traits', 'Rasgos raciales')}
                  helperText={t(
                    'racial_traits_hint',
                    'Elige del catálogo de la campaña o escribe un nombre personalizado',
                  )}
                />
              )}
            />
          </Grid>
        </Grid>
        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel', 'Cancelar')}</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving || !name.trim()}>
          {saving ? t('saving', 'Guardando...') : t('save', 'Guardar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
