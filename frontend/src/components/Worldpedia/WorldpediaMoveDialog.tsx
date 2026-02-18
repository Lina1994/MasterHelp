import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { WorldpediaFolderWithNotes } from '../../api/worldpedia/worldpediaApi';

interface Props {
  open: boolean;
  folders: WorldpediaFolderWithNotes[];
  currentFolderId: string | null;
  onClose: () => void;
  onMove: (folderId: string | null) => Promise<void>;
}

/**
 * Dialog that lets the user pick a target folder (or root) to move a note to.
 */
export default function WorldpediaMoveDialog({ open, folders, currentFolderId, onClose, onMove }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>(currentFolderId ?? '__root__');
  const [saving, setSaving] = useState(false);

  const handleMove = async () => {
    setSaving(true);
    try {
      await onMove(selected === '__root__' ? null : selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('worldpedia_move_note', 'Move note')}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel>{t('worldpedia_folders', 'Folders')}</InputLabel>
          <Select
            value={selected}
            label={t('worldpedia_folders', 'Folders')}
            onChange={(e) => setSelected(e.target.value)}
            disabled={saving}
          >
            <MenuItem value="__root__">{t('worldpedia_root', 'Root (no folder)')}</MenuItem>
            {folders.map((f) => (
              <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>{t('cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={handleMove} disabled={saving}>
          {t('worldpedia_move_note', 'Move note')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
