import React from 'react';
import { Button } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import { useNavigate } from 'react-router-dom';

/**
 * GotoMapsButton: botón para navegar a la vista de mapas.
 * Responsabilidad: navegación simple.
 */
export default function GotoMapsButton() {
  const navigate = useNavigate();
  return (
    <Button startIcon={<MapIcon />} size="small" variant="text" onClick={() => navigate('/maps')}>
      Ir a Mapas
    </Button>
  );
}
