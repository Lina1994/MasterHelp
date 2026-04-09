import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Chip, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

interface CreateManualDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { title: string; description?: string; version?: string; languages: string[] }) => Promise<void>;
}

const AVAILABLE_LANGS = ['es', 'en'];

/**
 * Dialog for creating a new custom manual.
 * Collects title, description, version, and supported languages.
 */
export default function CreateManualDialog({ open, onClose, onSave }: CreateManualDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [languages, setLanguages] = useState<string[]>(['es']);
  const [loading, setLoading] = useState(false);

  const toggleLang = (lang: string) => {
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang],
    );
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        version: version.trim() || undefined,
        languages,
      });
      resetForm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setVersion('');
    setLanguages(['es']);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {t('manuals_create_title')}
        <IconButton onClick={handleClose} size="small" disabled={loading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          label={t('manuals_field_title')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          fullWidth
          required
          autoFocus
          sx={{ mb: 2 }}
        />
        <TextField
          label={t('manuals_field_description')}
          value={description}
          onChange={e => setDescription(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          sx={{ mb: 2 }}
        />
        <TextField
          label={t('manuals_field_version')}
          value={version}
          onChange={e => setVersion(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />
        <Box>
          <Box sx={{ mb: 1, fontWeight: 500 }}>{t('manuals_field_languages')}</Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {AVAILABLE_LANGS.map(lang => (
              <Chip
                key={lang}
                label={lang.toUpperCase()}
                color={languages.includes(lang) ? 'primary' : 'default'}
                onClick={() => toggleLang(lang)}
                variant={languages.includes(lang) ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>{t('cancel')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || !title.trim()}
        >
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
