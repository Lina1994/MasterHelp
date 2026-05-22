import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

/**
 * Componente base reutilizable para menús contextuales de herramientas en el editor de escenas.
 * Permite mostrar una cabecera, contenido personalizado (lista de recursos, estilos, etc.) y soporta drag&drop.
 *
 * @param title Título del menú contextual (ej: "Librería de vídeos", "Estilos de texto").
 * @param children Contenido específico del menú (elementos draggeables, filtros, etc.).
 * @param onClose Función opcional para cerrar el menú contextual.
 */
export interface ContextualMenuBaseProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export const ContextualMenuBase: React.FC<ContextualMenuBaseProps> = ({ title, children, onClose }) => {
  return (
    <Paper elevation={6} sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1200, p: 2, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6">{title}</Typography>
        {onClose && (
          <Box component="button" onClick={onClose} sx={{ ml: 2, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }} aria-label="Cerrar menú contextual">
            ×
          </Box>
        )}
      </Box>
      <Box>
        {children}
      </Box>
    </Paper>
  );
};
