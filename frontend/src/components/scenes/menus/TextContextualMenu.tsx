import React from 'react';
import { Box, Button } from '@mui/material';
import { ContextualMenuBase } from '../ContextualMenuBase';

interface TextContextualMenuProps {
  onSelect: (type: { style: string; label: string }) => void;
  onClose: () => void;
}

const TEXT_TYPES = [
  { style: 'narration', label: 'Narración' },
  { style: 'title', label: 'Título' },
  { style: 'lower-third', label: 'Lower Third' },
  { style: 'subtitle', label: 'Subtítulo' },
];

export const TextContextualMenu: React.FC<TextContextualMenuProps> = ({ onSelect, onClose }) => (
  <ContextualMenuBase title="Añadir texto" onClose={onClose}>
    <Box mt={2} display="flex" gap={2} flexWrap="wrap">
      {TEXT_TYPES.map((t) => (
        <Button key={t.style} onClick={() => onSelect(t)} variant="outlined">
          {t.label}
        </Button>
      ))}
    </Box>
  </ContextualMenuBase>
);
