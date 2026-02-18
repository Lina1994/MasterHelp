import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  initialName: string;
  /** Override the dialog title / label (defaults to folder name). */
  titleLabel?: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

/**
 * Simple dialog for creating or renaming a folder (or entering a note title).
 */
export default function WorldpediaFolderDialog({ open, initialName, titleLabel, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens
  const handleEnter = () => setName(initialName);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth TransitionProps={{ onEnter: handleEnter }}>
      <DialogTitle>{titleLabel ?? t('worldpedia_folder_name', 'Folder name')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
          disabled={saving}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>{t('cancel', 'Cancel')}</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving || !name.trim()}>
          {t('save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
