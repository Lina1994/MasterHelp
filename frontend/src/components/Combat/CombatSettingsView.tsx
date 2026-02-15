import React, { useCallback, useEffect, useState } from 'react';
import { 
  Alert, 
  Box, 
  Divider, 
  FormControl,
  FormControlLabel, 
  InputLabel,
  MenuItem,
  Paper, 
  Select,
  Slider,
  Stack, 
  Switch, 
  Typography 
} from '@mui/material';
import type { Campaign } from '../Campaign/types';

/**
 * CombatSettingsView
 * 
 * Vista de ajustes de combate que permite configurar:
 * - Priorizar música de encuentros
 * - Tirada de iniciativa en Skyline
 * - Visualización de puntos de anclaje para tokens grandes
 * - Visualización de sombra de espacio ocupado para tokens grandes
 */
const CombatSettingsView: React.FC<{
  isMaster: boolean;
  campaign: Campaign | null;
  // Ajustes compartidos con CombatHeader
  prioritizeEncounterMusic: boolean;
  setPrioritizeEncounterMusic: (v: boolean) => void;
  showInitiativeStrip: boolean;
  onToggleInitiativeStrip: (v: boolean) => void;
}> = ({
  isMaster,
  campaign,
  prioritizeEncounterMusic,
  setPrioritizeEncounterMusic,
  showInitiativeStrip,
  onToggleInitiativeStrip,
}) => {
  // Nuevos ajustes para visualización de tokens
  const [showTokenAnchors, setShowTokenAnchors] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('app.combat.showTokenAnchors');
      return val === 'true';
    } catch {
      return true; // Por defecto activado
    }
  });

  const [showTokenShadow, setShowTokenShadow] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('app.combat.showTokenShadow');
      return val === 'true';
    } catch {
      return true; // Por defecto activado
    }
  });

  // Ajuste para mostrar imagen del turno actual en Skyline
  const [showCurrentTurnImage, setShowCurrentTurnImage] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('app.combat.showCurrentTurnImage');
      return val === null ? true : val === 'true';
    } catch {
      return true; // Por defecto activado
    }
  });

  // Position of current turn image
  const [currentTurnImagePosition, setCurrentTurnImagePosition] = useState<string>(() => {
    try {
      return localStorage.getItem('app.combat.currentTurnImagePosition') || 'center-right';
    } catch {
      return 'center-right';
    }
  });

  // Sizes (in vw) for each creature size category
  const [imageSizes, setImageSizes] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('app.combat.currentTurnImageSizes');
      if (stored) return JSON.parse(stored);
    } catch {}
    // Default sizes
    return {
      Tiny: 15,
      Small: 20,
      Medium: 30,
      Large: 40,
      Huge: 50,
      Gargantuan: 60,
    };
  });

  // Persistir ajustes de visualización de tokens
  useEffect(() => {
    try {
      localStorage.setItem('app.combat.showTokenAnchors', String(showTokenAnchors));
      // Broadcast para sincronizar con otras ventanas/tabs
      const bc = new BroadcastChannel('campaign-sync');
      bc.postMessage({
        type: 'tokenVisualizationUpdated',
        campaignId: campaign?.id,
        showTokenAnchors,
        at: Date.now(),
      });
      bc.close();
    } catch {}
  }, [showTokenAnchors, campaign?.id]);

  useEffect(() => {
    try {
      localStorage.setItem('app.combat.showTokenShadow', String(showTokenShadow));
      // Broadcast para sincronizar con otras ventanas/tabs
      const bc = new BroadcastChannel('campaign-sync');
      bc.postMessage({
        type: 'tokenVisualizationUpdated',
        campaignId: campaign?.id,
        showTokenShadow,
        at: Date.now(),
      });
      bc.close();
    } catch {}
  }, [showTokenShadow, campaign?.id]);

  useEffect(() => {
    try {
      localStorage.setItem('app.combat.showCurrentTurnImage', String(showCurrentTurnImage));
      // Broadcast para sincronizar con otras ventanas/tabs
      const bc = new BroadcastChannel('campaign-sync');
      bc.postMessage({
        type: 'skylineSettingsChanged',
        campaignId: campaign?.id,
        settings: { showCurrentTurnImage },
        at: Date.now(),
      });
      bc.close();
    } catch {}
  }, [showCurrentTurnImage, campaign?.id]);

  useEffect(() => {
    try {
      localStorage.setItem('app.combat.currentTurnImagePosition', currentTurnImagePosition);
      const bc = new BroadcastChannel('campaign-sync');
      bc.postMessage({
        type: 'skylineSettingsChanged',
        campaignId: campaign?.id,
        settings: { currentTurnImagePosition },
        at: Date.now(),
      });
      bc.close();
    } catch {}
  }, [currentTurnImagePosition, campaign?.id]);

  useEffect(() => {
    try {
      localStorage.setItem('app.combat.currentTurnImageSizes', JSON.stringify(imageSizes));
      const bc = new BroadcastChannel('campaign-sync');
      bc.postMessage({
        type: 'skylineSettingsChanged',
        campaignId: campaign?.id,
        settings: { currentTurnImageSizes: imageSizes },
        at: Date.now(),
      });
      bc.close();
    } catch {}
  }, [imageSizes, campaign?.id]);

  // Escuchar cambios de otras ventanas
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('campaign-sync');
      bc.onmessage = (e: MessageEvent) => {
        const data = e?.data;
        if (!data || data.campaignId !== campaign?.id) return;
        
        if (data.type === 'tokenVisualizationUpdated') {
          if (typeof data.showTokenAnchors === 'boolean') {
            setShowTokenAnchors(data.showTokenAnchors);
          }
          if (typeof data.showTokenShadow === 'boolean') {
            setShowTokenShadow(data.showTokenShadow);
          }
        }

        if (data.type === 'skylineSettingsChanged' && data.settings) {
          if (typeof data.settings.showCurrentTurnImage === 'boolean') {
            setShowCurrentTurnImage(data.settings.showCurrentTurnImage);
          }
          if (typeof data.settings.currentTurnImagePosition === 'string') {
            setCurrentTurnImagePosition(data.settings.currentTurnImagePosition);
          }
          if (data.settings.currentTurnImageSizes && typeof data.settings.currentTurnImageSizes === 'object') {
            setImageSizes(data.settings.currentTurnImageSizes);
          }
        }
      };
    } catch {}

    return () => {
      try {
        bc?.close();
      } catch {}
    };
  }, [campaign?.id]);

  if (!campaign?.id) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Ajustes de Combate</Typography>
        <Typography variant="body2" color="text.secondary">
          Selecciona una campaña para configurar los ajustes de combate.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {!isMaster && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Como jugador puedes consultar los ajustes, pero solo el máster puede modificarlos.
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Ajustes de música */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Música y Audio</Typography>
          <Stack spacing={1.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={prioritizeEncounterMusic}
                  onChange={(_, v) => setPrioritizeEncounterMusic(v)}
                  disabled={!isMaster}
                />
              }
              label="Priorizar música de encuentro"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
              Cuando está activo, la música del encuentro seleccionado se reproducirá automáticamente.
            </Typography>
          </Stack>
        </Paper>

        {/* Ajustes de Skyline */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Skyline</Typography>
          <Stack spacing={1.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={showInitiativeStrip}
                  onChange={(_, v) => onToggleInitiativeStrip(v)}
                  disabled={!isMaster}
                />
              }
              label="Tira de iniciativa en Skyline"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
              Muestra una barra con el orden de iniciativa en la proyección Skyline.
            </Typography>

            <Divider sx={{ my: 1 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={showCurrentTurnImage}
                  onChange={(_, v) => setShowCurrentTurnImage(v)}
                  disabled={!isMaster}
                />
              }
              label="Mostrar imagen del turno actual"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
              Muestra la imagen/ilustración del personaje o criatura cuyo turno está activo en la proyección Skyline.
            </Typography>

            {showCurrentTurnImage && (
              <>
                <Divider sx={{ my: 1 }} />
                
                <Box sx={{ ml: 4 }}>
                  <FormControl fullWidth size="small" disabled={!isMaster}>
                    <InputLabel id="turn-image-position-label">Posición de la imagen</InputLabel>
                    <Select
                      labelId="turn-image-position-label"
                      value={currentTurnImagePosition}
                      label="Posición de la imagen"
                      onChange={(e) => setCurrentTurnImagePosition(e.target.value)}
                    >
                      <MenuItem value="center-center">Centro - Centro</MenuItem>
                      <MenuItem value="center-right">Centro - Derecha</MenuItem>
                      <MenuItem value="center-left">Centro - Izquierda</MenuItem>
                      <MenuItem value="top-center">Arriba - Centro</MenuItem>
                      <MenuItem value="top-right">Arriba - Derecha</MenuItem>
                      <MenuItem value="top-left">Arriba - Izquierda</MenuItem>
                      <MenuItem value="bottom-center">Abajo - Centro</MenuItem>
                      <MenuItem value="bottom-right">Abajo - Derecha</MenuItem>
                      <MenuItem value="bottom-left">Abajo - Izquierda</MenuItem>
                    </Select>
                  </FormControl>

                  <Typography variant="body2" fontWeight="medium" sx={{ mt: 2, mb: 1 }}>
                    Tamaño por categoría de criatura (% del ancho de ventana):
                  </Typography>

                  {(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] as const).map((sizeCategory) => (
                    <Box key={sizeCategory} sx={{ mt: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {sizeCategory}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {imageSizes[sizeCategory]}%
                        </Typography>
                      </Box>
                      <Slider
                        value={imageSizes[sizeCategory]}
                        onChange={(_, v) => setImageSizes({ ...imageSizes, [sizeCategory]: v as number })}
                        min={10}
                        max={80}
                        step={5}
                        disabled={!isMaster}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => `${v}%`}
                      />
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Stack>
        </Paper>

        {/* Ajustes de visualización de tokens */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Visualización de Tokens</Typography>
          <Stack spacing={1.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={showTokenAnchors}
                  onChange={(_, v) => setShowTokenAnchors(v)}
                  disabled={!isMaster}
                />
              }
              label="Visualizar puntos de anclaje para tokens grandes"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
              Muestra puntos amarillos donde puedes colocar tokens Large, Huge y Gargantuan durante el arrastre.
            </Typography>

            <Divider sx={{ my: 1 }} />

            <FormControlLabel
              control={
                <Switch
                  checked={showTokenShadow}
                  onChange={(_, v) => setShowTokenShadow(v)}
                  disabled={!isMaster}
                />
              }
              label="Visualizar sombra de espacio ocupado para tokens grandes"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
              Muestra una sombra azul indicando las celdas que ocupará el token durante el arrastre.
            </Typography>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Typography variant="body2" color="text.secondary">
            💡 <strong>Nota:</strong> Los cambios en estos ajustes se sincronizan automáticamente con todas las ventanas abiertas de la aplicación.
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
};

export default CombatSettingsView;
