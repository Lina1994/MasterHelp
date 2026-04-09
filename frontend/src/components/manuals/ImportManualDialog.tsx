import { useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, IconButton, Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useTranslation } from 'react-i18next';
import type { ImportManualPayload } from '../../api/customManuals';

interface ImportManualDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (payload: ImportManualPayload) => Promise<void>;
}

/**
 * Dialog for importing a manual from a JSON file.
 * Shows a preview of the manual metadata before confirming.
 */
export default function ImportManualDialog({ open, onClose, onImport }: ImportManualDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState<ImportManualPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setPayload(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ImportManualPayload;
      if (!parsed.title || !Array.isArray(parsed.entries)) {
        setError(t('manuals_import_invalid'));
        return;
      }
      setPayload(parsed);
    } catch {
      setError(t('manuals_import_parse_error'));
    }
  };

  const handleImport = async () => {
    if (!payload) return;
    setLoading(true);
    try {
      await onImport(payload);
      handleClose();
    } catch {
      setError(t('manuals_import_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPayload(null);
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {t('manuals_import_title')}
        <IconButton onClick={handleClose} size="small" disabled={loading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadFileIcon />}
          >
            {t('manuals_import_select_file')}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={handleFileChange}
            />
          </Button>

          {error && <Alert severity="error">{error}</Alert>}

          {payload && (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>{payload.title}</Typography>
              {payload.description && (
                <Typography variant="body2" color="text.secondary">{payload.description}</Typography>
              )}
              {payload.version && (
                <Typography variant="body2" color="text.secondary">
                  {t('manuals_field_version')}: {payload.version}
                </Typography>
              )}
              <Typography variant="body2" sx={{ mt: 1 }}>
                {t('manuals_import_entry_count', { count: payload.entries.length })}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>{t('cancel')}</Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={loading || !payload}
        >
          {t('manuals_import_confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
