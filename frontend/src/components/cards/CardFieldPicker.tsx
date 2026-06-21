import { Button, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, TextField } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { useMemo, useRef, useState } from 'react';
import { CARD_FIELD_GROUPS } from './cardsFieldCatalog';
import type { CardEntityKind, CardSlotBinding, SlotType } from '../../types/cardTemplates';

/** Max upload size in MB: data URLs bloat JSON so we cap aggressively. */
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

/**
 * Compact form that binds a slot to a path on the entity. Exposes a
 * kind-driven field catalogue dropdown, an "isStatic" toggle for label-only
 * slots, optional prefix/suffix text fields, and an image uploader for
 * {@link IMAGE} slots where the user wants to embed a design-only asset
 * (e.g. a bard-college crest logo).
 */
export default function CardFieldPicker({
  binding,
  kind,
  slotType,
  onChange,
}: {
  binding: CardSlotBinding;
  kind: CardEntityKind | 'all';
  slotType?: SlotType;
  onChange: (next: CardSlotBinding) => void;
}) {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (kind === 'all') return CARD_FIELD_GROUPS;
    return CARD_FIELD_GROUPS.filter((g) => g.kind === kind);
  }, [kind]);

  const isImage = slotType === 'IMAGE';
  const hasUploadedImage = isImage && binding.isStatic && /^data:image\//.test(binding.fallbackText ?? '');

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFile = async (file: File) => {
    setUploadError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      setUploadError(t('cards_image_too_large', 'Imagen demasiado grande ({{size}}). Elige un archivo menor que {{max}}.', { size: `${mb} MB`, max: '1.5 MB' }));
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error ?? new Error('read error'));
      reader.readAsDataURL(file);
    });
    onChange({ ...binding, isStatic: true, fallbackText: dataUrl });
  };

  const handleRemoveImage = () => {
    // Only wipe the binding if the previous fallback was a data URL (an
    // image we uploaded). Keep any user-typed static text intact.
    if (/^data:image\//.test(binding.fallbackText ?? '')) {
      onChange({ ...binding, isStatic: false, fallbackText: '' });
    } else {
      onChange({ ...binding, isStatic: false });
    }
    setUploadError(null);
  };

  return (
    <Stack spacing={1.25}>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={!!binding.isStatic}
            onChange={(_, checked) => onChange({ ...binding, isStatic: checked })}
          />
        }
        label={t('cards_binding_static', 'Texto estático (no dependiente de la entidad)')}
      />
      {!binding.isStatic && (
        <FormControl size="small" fullWidth>
          <InputLabel>{t('cards_binding_field', 'Campo')}</InputLabel>
          <Select
            label={t('cards_binding_field', 'Campo')}
            value={binding.fieldPath ?? ''}
            onChange={(e) => onChange({ ...binding, fieldPath: e.target.value as string })}
          >
            {groups.flatMap((group) => [
              <MenuItem key={`header-${group.kind}`} disabled sx={{ opacity: '0.7 !important' }}>
                <em>{group.label}</em>
              </MenuItem>,
              ...group.fields.map((field) => (
                // Two-line layout: the field label sits next to its dot-path
                // (so power users can copy the exact binding) and the
                // optional `hint` surfaces below so users know what each
                // binding actually resolves to — e.g. `components`
                // resolves to "V, S, M" while `materials` resolves to the
                // parenthetical material text. Wrapped to avoid breaking
                // the long MUI MenuItem row on small viewports.
                <MenuItem
                  key={`${group.kind}-${field.path}`}
                  value={field.path}
                  sx={{ pl: 4, alignItems: 'flex-start' }}
                >
                  <Stack spacing={0.15} sx={{ width: '100%' }}>
                    <span>
                      {field.label}{' '}
                      <span style={{ opacity: 0.55, marginLeft: 6 }}>({group.kind}.{field.path})</span>
                    </span>
                    {field.hint && (
                      <span style={{ opacity: 0.65, fontSize: 11 }}>{field.hint}</span>
                    )}
                  </Stack>
                </MenuItem>
              )),
            ])}
          </Select>
        </FormControl>
      )}
      <TextField
        size="small"
        label={
          binding.isStatic
            ? t('cards_binding_text', 'Texto fijo')
            : t('cards_binding_fallback', 'Texto por defecto (cuando el campo está vacío)')
        }
        value={binding.fallbackText ?? ''}
        onChange={(e) => onChange({ ...binding, fallbackText: e.target.value })}
        fullWidth
      />
      {!binding.isStatic && (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            label={t('cards_binding_prefix', 'Prefijo')}
            value={binding.prefix ?? ''}
            onChange={(e) => onChange({ ...binding, prefix: e.target.value })}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label={t('cards_binding_suffix', 'Sufijo')}
            value={binding.suffix ?? ''}
            onChange={(e) => onChange({ ...binding, suffix: e.target.value })}
            sx={{ flex: 1 }}
          />
        </Stack>
      )}

      {isImage && (
        <Stack spacing={0.75}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          {hasUploadedImage ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <img
                src={binding.fallbackText ?? ''}
                alt={t('cards_image_uploaded', 'Imagen subida — se usa como contenido del slot.')}
                style={{ height: 36, maxWidth: 60, objectFit: 'contain', borderRadius: 4, border: '1px solid rgba(0,0,0,0.15)' }}
              />
              <Button size="small" startIcon={<ImageIcon />} onClick={handlePickImage}>
                {t('cards_image_replace', 'Reemplazar')}
              </Button>
              <Button size="small" startIcon={<DeleteOutlineIcon />} color="error" onClick={handleRemoveImage}>
                {t('cards_image_remove', 'Quitar')}
              </Button>
              <span style={{ fontSize: 11, opacity: 0.6 }}>({t('cards_static', 'estático')} · {i18n.language})</span>
            </Stack>
          ) : (
            <Button size="small" variant="outlined" startIcon={<ImageIcon />} onClick={handlePickImage}>
              {t('cards_image_upload', 'Subir imagen')}
            </Button>
          )}
          {uploadError && <span style={{ fontSize: 11, color: '#c62828' }}>{uploadError}</span>}
        </Stack>
      )}
    </Stack>
  );
}
