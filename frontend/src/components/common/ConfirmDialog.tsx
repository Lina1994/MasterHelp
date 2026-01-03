import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  confirmDisabled?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmColor = 'error',
  confirmDisabled = false,
  onClose,
  onConfirm,
}) => {
  return (
    <Dialog open={open} onClose={() => (!confirmDisabled && onClose())}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {message}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={confirmDisabled}>{cancelLabel}</Button>
        <Button color={confirmColor} variant="contained" onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
