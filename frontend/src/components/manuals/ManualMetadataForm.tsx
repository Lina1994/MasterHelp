import { useState, useEffect, useRef } from 'react';
import {
  Box, TextField, Chip, Stack, Typography, IconButton, Tooltip, Button,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { useTranslation } from 'react-i18next';
import { updateManual, uploadManualCover, removeManualCover, getManualCoverUrl, type ManualDetail, type UpdateManualDto } from '../../api/customManuals';
import AuthImage from '../common/AuthImage';

interface ManualMetadataFormProps {
  manual: ManualDetail;
  hasCover?: boolean;
  onUpdated: (m: ManualDetail) => void;
  onCoverChanged?: () => void;
}

const AVAILABLE_LANGS = ['es', 'en'];

/**
 * Inline-editable form for manual metadata (title, description, version, languages)
 * with optional cover image upload.
 */
export default function ManualMetadataForm({ manual, hasCover, onUpdated, onCoverChanged }: ManualMetadataFormProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(manual.title);
  const [description, setDescription] = useState(manual.description ?? '');
  const [version, setVersion] = useState(manual.version ?? '');
  const [languages, setLanguages] = useState<string[]>(manual.languages ?? ['es']);
  const [saving, setSaving] = useState(false);
  const [coverKey, setCoverKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(manual.title);
    setDescription(manual.description ?? '');
    setVersion(manual.version ?? '');
    setLanguages(manual.languages ?? ['es']);
  }, [manual]);

  const toggleLang = (lang: string) => {
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang],
    );
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const dto: UpdateManualDto = {
        title: title.trim(),
        description: description.trim() || undefined,
        version: version.trim() || undefined,
        languages,
      };
      const updated = await updateManual(manual.id, dto);
      onUpdated(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadManualCover(manual.id, file);
    setCoverKey(prev => prev + 1);
    onCoverChanged?.();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCoverRemove = async () => {
    await removeManualCover(manual.id);
    setCoverKey(prev => prev + 1);
    onCoverChanged?.();
  };

  /** Shared cover image block rendered in both view and edit modes. */
  const coverBlock = (
    <Stack spacing={1}>
      {hasCover && (
        <Box sx={{ maxWidth: 260, borderRadius: 1, overflow: 'hidden' }}>
          <AuthImage
            key={coverKey}
            src={getManualCoverUrl(manual.id)}
            alt={manual.title}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </Box>
      )}
      <Stack direction="row" spacing={1}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleCoverUpload}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddPhotoAlternateIcon />}
          onClick={() => fileInputRef.current?.click()}
        >
          {hasCover ? t('manuals_cover_replace', 'Cambiar portada') : t('manuals_cover_upload', 'Subir portada')}
        </Button>
        {hasCover && (
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={handleCoverRemove}
          >
            {t('manuals_cover_remove', 'Quitar portada')}
          </Button>
        )}
      </Stack>
    </Stack>
  );

  if (!editing) {
    return (
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box>
            <Typography variant="h5">{manual.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {manual.version ? `v${manual.version}` : ''}
              {manual.description ? ` — ${manual.description}` : ''}
            </Typography>
          </Box>
          <Tooltip title={t('manuals_edit')}>
            <IconButton size="small" onClick={() => setEditing(true)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        {coverBlock}
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label={t('manuals_field_title')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          size="small"
          required
          fullWidth
        />
        <TextField
          label={t('manuals_field_version')}
          value={version}
          onChange={e => setVersion(e.target.value)}
          size="small"
          sx={{ width: 120 }}
        />
      </Stack>
      <TextField
        label={t('manuals_field_description')}
        value={description}
        onChange={e => setDescription(e.target.value)}
        size="small"
        fullWidth
        multiline
        minRows={1}
      />
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2">{t('manuals_field_languages')}:</Typography>
        {AVAILABLE_LANGS.map(lang => (
          <Chip
            key={lang}
            label={lang.toUpperCase()}
            size="small"
            color={languages.includes(lang) ? 'primary' : 'default'}
            onClick={() => toggleLang(lang)}
            variant={languages.includes(lang) ? 'filled' : 'outlined'}
          />
        ))}
        <Tooltip title={t('save')}>
          <IconButton
            size="small"
            color="primary"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            <CheckIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {coverBlock}
    </Stack>
  );
}
