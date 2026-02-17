import React, { useState, useEffect } from 'react';
import { TextField, Box } from '@mui/material';
import { ShopCell, updateCellText } from '../../api/shops';

interface CellEditorProps {
  cell: ShopCell | null;
  entryId?: string;
  columnId?: string;
  onUpdate: () => void;
}

export const CellEditor: React.FC<CellEditorProps> = ({ cell, onUpdate }) => {
  const [value, setValue] = useState(cell?.textValue || '');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setValue(cell?.textValue || '');
  }, [cell]);

  const handleBlur = async () => {
    setEditing(false);
    
    if (!cell?.id) {
      console.warn('Cell does not exist yet - should be created automatically');
      return;
    }

    if (value === (cell.textValue || '')) return;

    try {
      await updateCellText(cell.id, value);
      onUpdate();
    } catch (error: any) {
      console.error('Failed to update cell:', error);
      alert(error?.response?.data?.message || 'Error al actualizar celda');
      setValue(cell.textValue || '');
    }
  };

  return (
    <Box>
      <TextField
        size="small"
        fullWidth
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={handleBlur}
        placeholder={editing ? 'Escribe aquí...' : 'Click para editar'}
        variant="standard"
        disabled={!cell}
      />
    </Box>
  );
};
