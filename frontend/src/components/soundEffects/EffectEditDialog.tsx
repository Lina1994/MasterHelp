import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Box } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { SoundEffectMeta } from '../../types/soundEffects';

interface EffectEditDialogProps {
  open: boolean;
  effect: SoundEffectMeta | null;
  efEditName: string;
  efEditCategory: string;
  savingEf: boolean;
  onClose: () => void;
  onChangeName: (v: string) => void;
  onChangeCategory: (v: string) => void;
  onRequestDelete: () => void;
  onSave: () => void;
}

export const EffectEditDialog: React.FC<EffectEditDialogProps> = ({
  open,
  effect,
  efEditName,
  efEditCategory,
  savingEf,
  onClose,
  onChangeName,
  onChangeCategory,
  onRequestDelete,
  onSave,
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar efecto</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} mt={1}>
          <TextField label="Nombre" size="small" value={efEditName} onChange={e => onChangeName(e.target.value)} />
          <TextField label="Categoría" size="small" value={efEditCategory} onChange={e => onChangeCategory(e.target.value)} />
          <Box>
            <Button color="error" startIcon={<DeleteIcon />} onClick={onRequestDelete}>Eliminar efecto…</Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!effect || savingEf} onClick={onSave} startIcon={<EditIcon />}>Guardar</Button>
      </DialogActions>
    </Dialog>
  );
};
