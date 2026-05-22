import React from 'react';
import { Tabs, Tab, Box, Button } from '@mui/material';
import { ContextualMenuBase } from '../ContextualMenuBase';

interface ImageContextualMenuProps {
  onSelect: (image: { url: string; label: string }) => void;
  onClose: () => void;
}

const TABS = [
  { label: 'Personajes', value: 'characters' },
  { label: 'Bestiario', value: 'bestiary' },
  { label: 'Mapas', value: 'maps' },
  { label: 'Tienda', value: 'shop' },
  { label: 'Subir imagen', value: 'upload' },
];

export const ImageContextualMenu: React.FC<ImageContextualMenuProps> = ({ onSelect, onClose }) => {
  const [tab, setTab] = React.useState('characters');

  // TODO: Cargar imágenes reales según la pestaña
  const images = [
    { url: '/placeholder1.png', label: 'Imagen 1' },
    { url: '/placeholder2.png', label: 'Imagen 2' },
  ];

  return (
    <ContextualMenuBase title="Añadir imagen" onClose={onClose}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        {TABS.map((t) => (
          <Tab key={t.value} label={t.label} value={t.value} />
        ))}
      </Tabs>
      <Box mt={2} display="flex" gap={2} flexWrap="wrap">
        {tab !== 'upload' ? (
          images.map((img) => (
            <Button key={img.url} onClick={() => onSelect(img)} variant="outlined">
              <img src={img.url} alt={img.label} style={{ width: 64, height: 64, objectFit: 'cover', marginRight: 8 }} />
              {img.label}
            </Button>
          ))
        ) : (
          <Button variant="contained">Subir imagen</Button>
        )}
      </Box>
    </ContextualMenuBase>
  );
};
