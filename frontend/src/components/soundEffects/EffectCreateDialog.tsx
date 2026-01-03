import React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

interface EffectCreateDialogProps {
  open: boolean;
  onClose: () => void;
  efName: string;
  efCategory: string;
  efUrl: string;
  efFiles: File[];
  efIsDragging: boolean;
  efUploadProgress: Record<string, number>;
  creatingEf: boolean;
  onChangeName: (v: string) => void;
  onChangeCategory: (v: string) => void;
  onChangeUrl: (v: string) => void;
  onToggleDragging: (v: boolean) => void;
  onFilesSelected: (files: File[]) => void;
  onSubmit: () => void;
}

export const EffectCreateDialog: React.FC<EffectCreateDialogProps> = ({
  open,
  onClose,
  efName,
  efCategory,
  efUrl,
  efFiles,
  efIsDragging,
  efUploadProgress,
  creatingEf,
  onChangeName,
  onChangeCategory,
  onChangeUrl,
  onToggleDragging,
  onFilesSelected,
  onSubmit,
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Nuevo efecto</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} mt={1}>
          {efFiles.length <= 1 && (
            <TextField label="Nombre" size="small" value={efName} onChange={e => onChangeName(e.target.value)} />
          )}
          <TextField label="Categoría (opcional)" size="small" value={efCategory} onChange={e => onChangeCategory(e.target.value)} />
          <TextField label="URL (opcional)" size="small" value={efUrl} onChange={e => onChangeUrl(e.target.value)} disabled={efFiles.length>0} />
          <Typography variant="caption" color="text.secondary">
            En un lote, cada efecto usará su nombre de archivo; la categoría se aplica a todos.
          </Typography>
          <Box
            sx={{
              p: 2,
              border: '2px dashed',
              borderColor: efIsDragging ? 'primary.main' : 'divider',
              borderRadius: 1,
              textAlign: 'center',
              bgcolor: efIsDragging ? 'action.hover' : 'transparent',
              cursor: 'pointer',
            }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onToggleDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); onToggleDragging(false); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation(); onToggleDragging(false);
              const dropped = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('audio/'));
              if (dropped.length) onFilesSelected(dropped);
            }}
            onClick={() => { (document.getElementById('ef-file-multi') as HTMLInputElement | null)?.click(); }}
          >
            <Typography variant="body2" color="text.secondary">Arrastra aquí archivos de audio o haz click para seleccionarlos</Typography>
            <input id="ef-file-multi" type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={e => {
              const list = Array.from(e.target.files || []);
              if (!list.length) return;
              onFilesSelected(list);
            }} />
          </Box>
          {efFiles.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">Seleccionados: {efFiles.length} archivo(s)</Typography>
              <List dense>
                {efFiles.slice(0, 5).map(f => {
                  const key = f.name + ':' + f.size;
                  const pct = efUploadProgress[key];
                  return (
                    <ListItem key={key} sx={{ alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <ListItemText primary={f.name} secondary={`${(f.size/1024).toFixed(1)} KB`} />
                        {creatingEf && (
                          <Box sx={{ pr: 2 }}>
                            <LinearProgress variant={typeof pct === 'number' ? 'determinate' : 'indeterminate'} value={pct ?? 0} />
                            <Typography variant="caption" color="text.secondary">{typeof pct === 'number' ? `${pct}%` : 'Subiendo…'}</Typography>
                          </Box>
                        )}
                      </Box>
                    </ListItem>
                  );
                })}
                {efFiles.length > 5 && (
                  <ListItem><ListItemText primary={`… y ${efFiles.length - 5} más`} /></ListItem>
                )}
              </List>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={creatingEf || (!(efFiles.length > 0) && !(efUrl.trim() && efName.trim()))} onClick={onSubmit} startIcon={<AddIcon />}>Crear</Button>
      </DialogActions>
    </Dialog>
  );
};
