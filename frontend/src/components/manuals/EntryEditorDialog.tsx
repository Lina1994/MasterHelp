import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, IconButton, MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { ManualEntry, ManualEntryType } from '../../api/customManuals';

import SectionForm from './entry-forms/SectionForm';
import SimpleEntryForm from './entry-forms/SimpleEntryForm';
import SpellForm from './entry-forms/SpellForm';
import BackgroundForm from './entry-forms/BackgroundForm';
import MonsterForm from './entry-forms/MonsterForm';
import RaceForm from './entry-forms/RaceForm';
import ClassForm from './entry-forms/ClassForm';

interface EntryEditorDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, the dialog enters "edit" mode. */
  entry?: ManualEntry;
  /** Fixed entry type when creating from a typed tab. */
  entryType: ManualEntryType;
  /** Available languages from the manual. */
  languages: string[];
  /** Callback with the entry key, data, and lang for saving. */
  onSave: (entryKey: string, lang: string, data: Record<string, any>) => Promise<void>;
}

/**
 * Generates a URL-safe slug from a display name.
 */
function toSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Returns sensible default values for a new entry of the given type.
 * Prevents fields with visual defaults (e.g. level=0) from being omitted
 * when the user never interacts with the corresponding control.
 */
function getDefaultData(type: ManualEntryType): Record<string, any> {
  switch (type) {
    case 'spell':
      return { level: 0, concentration: false, ritual: false };
    default:
      return {};
  }
}

/**
 * Universal dialog for creating / editing a manual entry.
 * Delegates the form body to a type-specific component.
 */
export default function EntryEditorDialog({
  open, onClose, entry, entryType, languages, onSave,
}: EntryEditorDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!entry;

  const [lang, setLang] = useState(languages[0] ?? 'es');
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (entry) {
      setLang(entry.lang);
      setData({ ...entry.data });
    } else {
      setLang(languages[0] ?? 'es');
      setData(getDefaultData(entryType));
    }
  }, [entry, languages, open, entryType]);

  /** Derive the slug from the entered name/title. */
  const derivedKey = isEdit
    ? entry!.entryKey
    : toSlug(data.name ?? data.title ?? '');

  const handleSave = async () => {
    if (!derivedKey) return;
    setLoading(true);
    try {
      await onSave(derivedKey, lang, data);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) onClose();
  };

  const renderForm = () => {
    switch (entryType) {
      case 'section':
        return <SectionForm data={data} onChange={setData} />;
      case 'feat':
      case 'trait':
      case 'skill':
        return <SimpleEntryForm entryType={entryType} data={data} onChange={setData} />;
      case 'spell':
        return <SpellForm data={data} onChange={setData} />;
      case 'background':
        return <BackgroundForm data={data} onChange={setData} />;
      case 'monster':
        return <MonsterForm data={data} onChange={setData} />;
      case 'race':
        return <RaceForm data={data} onChange={setData} />;
      case 'class':
        return <ClassForm data={data} onChange={setData} />;
      default:
        return null;
    }
  };

  const typeLabel = t(`manuals_type_${entryType}`);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {isEdit ? t('manuals_entry_edit', { type: typeLabel }) : t('manuals_entry_new', { type: typeLabel })}
        <IconButton onClick={handleClose} size="small" disabled={loading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* ── Language selector ── */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 4 }}>
            <TextField
              label={t('manuals_field_languages')}
              value={lang}
              onChange={e => setLang(e.target.value)}
              select
              fullWidth
            >
              {languages.map(l => (
                <MenuItem key={l} value={l}>{l.toUpperCase()}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        {/* ── Type-specific form ── */}
        {renderForm()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>{t('cancel')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || !derivedKey}
        >
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
