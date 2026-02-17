import React, { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  ShopSection,
  createColumn,
  updateColumn,
  deleteColumn,
  deleteSection,
  updateSection,
  CellType,
} from '../../api/shops';
import { EntryTable } from './EntryTable';
import ConfirmDialog from '../common/ConfirmDialog';

interface SectionManagerProps {
  section: ShopSection;
  onUpdate: () => void;
}

export const SectionManager: React.FC<SectionManagerProps> = ({ section, onUpdate }) => {
  const [editingColumns, setEditingColumns] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState<CellType>('text');
  const [deleteSectionConfirmOpen, setDeleteSectionConfirmOpen] = useState(false);
  const [deleteColumnConfirmOpen, setDeleteColumnConfirmOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;

    try {
      await createColumn(section.id, {
        name: newColumnName,
        cellType: newColumnType,
        order: section.columns?.length || 0,
      });
      setNewColumnName('');
      setNewColumnType('text');
      onUpdate();
    } catch (error: any) {
      console.error('Failed to create column:', error);
      alert(error?.response?.data?.message || 'Error al crear columna');
    }
  };

  const handleDeleteColumn = async () => {
    if (!columnToDelete) return;

    try {
      await deleteColumn(columnToDelete);
      setDeleteColumnConfirmOpen(false);
      setColumnToDelete(null);
      onUpdate();
    } catch (error: any) {
      console.error('Failed to delete column:', error);
      alert(error?.response?.data?.message || 'Error al eliminar columna');
    }
  };

  const handleDeleteSection = async () => {
    try {
      await deleteSection(section.id);
      onUpdate();
    } catch (error: any) {
      console.error('Failed to delete section:', error);
      alert(error?.response?.data?.message || 'Error al eliminar sección');
    }
  };

  const sortedColumns = [...(section.columns || [])].sort((a, b) => a.order - b.order);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">{section.name}</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant={editingColumns ? 'contained' : 'outlined'}
            onClick={() => setEditingColumns(!editingColumns)}
          >
            {editingColumns ? 'Ver Tabla' : 'Configurar Columnas'}
          </Button>
          <IconButton
            size="small"
            color="error"
            onClick={() => setDeleteSectionConfirmOpen(true)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {editingColumns ? (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Columnas
          </Typography>

          {sortedColumns.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No hay columnas definidas
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ mb: 2 }}>
              {sortedColumns.map((column) => (
                <Paper key={column.id} sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography sx={{ flex: 1 }}>{column.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {column.cellType}
                  </Typography>
                  <IconButton size="small" onClick={() => {
                    setColumnToDelete(column.id);
                    setDeleteColumnConfirmOpen(true);
                  }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Paper>
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              label="Nombre de columna"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={newColumnType}
                onChange={(e) => setNewColumnType(e.target.value as CellType)}
                label="Tipo"
              >
                <MenuItem value="text">Texto</MenuItem>
                <MenuItem value="image">Imagen</MenuItem>
                <MenuItem value="video">Video</MenuItem>
                <MenuItem value="audio">Audio</MenuItem>
                <MenuItem value="gif">GIF</MenuItem>
              </Select>
            </FormControl>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddColumn}>
              Añadir
            </Button>
          </Stack>
        </Paper>
      ) : (
        <EntryTable section={section} onUpdate={onUpdate} />
      )}

      <ConfirmDialog
        open={deleteSectionConfirmOpen}
        title="Eliminar sección"
        message={`¿Estás seguro de que quieres eliminar "${section.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDeleteSection}
        onClose={() => setDeleteSectionConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteColumnConfirmOpen}
        title="Eliminar columna"
        message="¿Estás seguro de que quieres eliminar esta columna? Se borrarán todos los datos de esta columna."
        onConfirm={handleDeleteColumn}
        onClose={() => {
          setDeleteColumnConfirmOpen(false);
          setColumnToDelete(null);
        }}
      />
    </Box>
  );
};
