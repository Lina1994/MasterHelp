import React from 'react';
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Checkbox } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { SoundEffectMeta } from '../../types/soundEffects';
import { PresetItemInput, PresetItemsEditor } from './PresetItemsEditor';

interface PresetDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  name: string;
  onNameChange: (v: string) => void;
  associatedEffects: SoundEffectMeta[];
  items: PresetItemInput[];
  effectsById: Map<string, SoundEffectMeta>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onRequestDelete?: () => void;
  onItemsChange: (next: PresetItemInput[]) => void;
}

export const PresetDialog: React.FC<PresetDialogProps> = ({
  open,
  mode,
  name,
  onNameChange,
  associatedEffects,
  items,
  effectsById,
  saving,
  onClose,
  onSubmit,
  onRequestDelete,
  onItemsChange,
}) => {
  const handleSelectionChange = (_: any, values: SoundEffectMeta[]) => {
    // Preserve existing item settings when possible
    const map = new Map(items.map(p => [p.soundEffectId, p] as const));
    const next: PresetItemInput[] = [];
    for (const v of values) {
      next.push(map.get(v.id) ?? { soundEffectId: v.id, volume: 1, loopMode: 'continuous' });
    }
    onItemsChange(next);
  };

  const selectedEffects = items
    .map(it => effectsById.get(it.soundEffectId))
    .filter(Boolean) as SoundEffectMeta[];

  const submitLabel = mode === 'create' ? 'Crear' : 'Guardar';
  const submitIcon = mode === 'create' ? <AddIcon /> : <EditIcon />;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'create' ? 'Nuevo preset' : 'Editar preset'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} mt={1}>
          <TextField label="Nombre" size="small" value={name} onChange={e => onNameChange(e.target.value)} />
          {mode === 'edit' && onRequestDelete && (
            <Box>
              <Button color="error" startIcon={<DeleteIcon />} onClick={onRequestDelete}>Eliminar preset…</Button>
            </Box>
          )}
          <Autocomplete
            multiple
            size="small"
            options={associatedEffects}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(o,v) => o.id === v.id}
            value={selectedEffects}
            disableCloseOnSelect
            onChange={handleSelectionChange}
            renderOption={(props, option, { selected }) => (
              <li {...props}>
                <Checkbox
                  icon={<AddIcon fontSize="small" />}
                  checkedIcon={<AddIcon fontSize="small" />}
                  style={{ marginRight: 8 }}
                  checked={selected}
                />
                {option.name}
              </li>
            )}
            renderInput={(params) => <TextField {...params} label="Efectos (asociados)" />}
          />
          <PresetItemsEditor items={items} effectsById={effectsById} onChange={onItemsChange} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={saving || !name.trim()} onClick={onSubmit} startIcon={submitIcon}>{submitLabel}</Button>
      </DialogActions>
    </Dialog>
  );
};
