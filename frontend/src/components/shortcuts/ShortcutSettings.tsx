import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, Switch, Typography } from '@mui/material';
import { useState } from 'react';
import { useShortcuts } from '../../contexts/ShortcutsContext';

/**
 * Settings panel for shell-level shortcut placement.
 */
const ShortcutSettings = () => {
  const { config, saveConfig } = useShortcuts();
  const [draft, setDraft] = useState(config);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Controla dónde se muestran los atajos rápidos del máster.
      </Typography>
      <Stack spacing={1.25}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="body2">Mostrar sección en Inicio</Typography>
          <Switch checked={draft.showHomeSection} onChange={(_, checked) => setDraft((prev) => ({ ...prev, showHomeSection: checked }))} />
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="body2">Mostrar panel rápido en sidebar</Typography>
          <Switch checked={draft.showSidebarPanel} onChange={(_, checked) => setDraft((prev) => ({ ...prev, showSidebarPanel: checked }))} />
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="body2">Mostrar barra inferior</Typography>
          <Switch checked={draft.showHotbar} onChange={(_, checked) => setDraft((prev) => ({ ...prev, showHotbar: checked }))} />
        </Stack>
        <FormControl size="small" fullWidth>
          <InputLabel id="shortcuts-columns-label">Columnas del panel lateral</InputLabel>
          <Select
            labelId="shortcuts-columns-label"
            label="Columnas del panel lateral"
            value={draft.sidebarPanelColumns}
            onChange={(event) => setDraft((prev) => ({ ...prev, sidebarPanelColumns: Number(event.target.value) as 1 | 2 | 3 }))}
          >
            <MenuItem value={1}>1 columna</MenuItem>
            <MenuItem value={2}>2 columnas</MenuItem>
            <MenuItem value={3}>3 columnas</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" onClick={() => saveConfig(draft)}>
          Guardar configuración de atajos
        </Button>
      </Stack>
    </Box>
  );
};

export default ShortcutSettings;