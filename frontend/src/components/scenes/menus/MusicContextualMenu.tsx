import React from 'react';
import { Tabs, Tab, Box, Button } from '@mui/material';
import { ContextualMenuBase } from '../ContextualMenuBase';

interface MusicContextualMenuProps {
  onSelect: (music: { id: string; label: string }) => void;
  onClose: () => void;
}

const TABS = [
  { label: 'Soundtrack', value: 'soundtrack' },
  { label: 'Efectos', value: 'effects' },
];

export const MusicContextualMenu: React.FC<MusicContextualMenuProps> = ({ onSelect, onClose }) => {
  const [tab, setTab] = React.useState('soundtrack');

  // TODO: Cargar canciones/efectos reales según la pestaña
  const items = [
    { id: 'track1', label: 'Canción 1' },
    { id: 'track2', label: 'Canción 2' },
  ];

  return (
    <ContextualMenuBase title="Añadir música o efecto" onClose={onClose}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        {TABS.map((t) => (
          <Tab key={t.value} label={t.label} value={t.value} />
        ))}
      </Tabs>
      <Box mt={2} display="flex" gap={2} flexWrap="wrap">
        {items.map((item) => (
          <Button key={item.id} onClick={() => onSelect(item)} variant="outlined">
            {item.label}
          </Button>
        ))}
      </Box>
    </ContextualMenuBase>
  );
};
