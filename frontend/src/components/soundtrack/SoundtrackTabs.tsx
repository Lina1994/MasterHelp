import { Tabs, Tab, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export type SoundtrackTab = 'songs' | 'effects';

/**
 * Cabecera con pestañas para navegar entre Canciones y Efectos dentro de Soundtrack.
 * - songs -> /soundtrack
 * - effects -> /soundtrack/effects
 */
export const SoundtrackTabs: React.FC<{ current: SoundtrackTab }> = ({ current }) => {
  const navigate = useNavigate();
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
      <Tabs value={current} onChange={(_, val) => {
        if (val === 'songs') navigate('/soundtrack');
        if (val === 'effects') navigate('/soundtrack/effects');
      }}>
        <Tab value="songs" label="Canciones" />
        <Tab value="effects" label="Efectos" />
      </Tabs>
    </Box>
  );
};
