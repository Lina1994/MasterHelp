import React, { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { ShopSection, createEntry, deleteEntry, ShopEntry } from '../../api/shops';
import { CellEditor } from './CellEditor';
import { MediaCell } from './MediaCell';
import ConfirmDialog from '../common/ConfirmDialog';

interface EntryTableProps {
  section: ShopSection;
  onUpdate: () => void;
}

export const EntryTable: React.FC<EntryTableProps> = ({ section, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  const handleAddEntry = async () => {
    try {
      await createEntry(section.id, { order: section.entries?.length || 0 });
      onUpdate();
    } catch (error: any) {
      console.error('Failed to create entry:', error);
      alert(error?.response?.data?.message || 'Error al crear entrada');
    }
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    try {
      await deleteEntry(entryToDelete);
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
      onUpdate();
    } catch (error: any) {
      console.error('Failed to delete entry:', error);
      alert(error?.response?.data?.message || 'Error al eliminar entrada');
    }
  };

  const sortedColumns = [...(section.columns || [])].sort((a, b) => a.order - b.order);
  const sortedEntries = [...(section.entries || [])].sort((a, b) => a.order - b.order);

  // Simple search filter
  const filteredEntries = sortedEntries.filter((entry) => {
    if (!searchTerm.trim()) return true;
    return entry.cells?.some((cell) =>
      cell.textValue?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (sortedColumns.length === 0) {
    return (
      <Typography color="text.secondary">
        Primero configura las columnas de esta sección
      </Typography>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flex: 1 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddEntry}>
          Nueva Entrada
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {sortedColumns.map((column) => (
                <TableCell key={column.id}>{column.name}</TableCell>
              ))}
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={sortedColumns.length + 1} align="center">
                  <Typography color="text.secondary">
                    {searchTerm ? 'No se encontraron entradas' : 'No hay entradas'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  {sortedColumns.map((column) => {
                    const cell = entry.cells?.find((c) => c.columnId === column.id);
                    return (
                      <TableCell key={column.id}>
                        {column.cellType === 'text' ? (
                          <CellEditor cell={cell || null} onUpdate={onUpdate} />
                        ) : (
                          <MediaCell cell={cell || null} onUpdate={onUpdate} />
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <IconButton size="small" onClick={() => {
                      setEntryToDelete(entry.id);
                      setDeleteConfirmOpen(true);
                    }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Eliminar entrada"
        message="¿Estás seguro de que quieres eliminar esta entrada?"
        onConfirm={handleDeleteEntry}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setEntryToDelete(null);
        }}
      />
    </Box>
  );
};
