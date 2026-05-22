import React from 'react';
import { Box, Button, MenuItem, Select, Typography } from '@mui/material';
import { ContextualMenuBase } from '../ContextualMenuBase';

interface FilterContextualMenuProps {
  onSelect: (filter: { type: string; value?: any }) => void;
  onClose: () => void;
}

const FILTERS = [
  { type: 'blur', label: 'Desenfoque' },
  { type: 'sepia', label: 'Sepia' },
  { type: 'grayscale', label: 'Blanco y negro' },
  { type: 'brightness', label: 'Brillo' },
];

export const FilterContextualMenu: React.FC<FilterContextualMenuProps> = ({ onSelect, onClose }) => {
  const [selected, setSelected] = React.useState('blur');

  return (
    <ContextualMenuBase title="Añadir filtro" onClose={onClose}>
      <Typography variant="subtitle1" mb={1}>Tipo de filtro</Typography>
      <Select value={selected} onChange={e => setSelected(e.target.value)} fullWidth>
        {FILTERS.map(f => (
          <MenuItem key={f.type} value={f.type}>{f.label}</MenuItem>
        ))}
      </Select>
      <Box mt={2}>
        <Button variant="contained" onClick={() => onSelect(FILTERS.find(f => f.type === selected) || FILTERS[0])}>
          Añadir filtro
        </Button>
      </Box>
    </ContextualMenuBase>
  );
};
