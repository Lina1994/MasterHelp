import React from 'react';
import { Stack, Typography, FormControl, InputLabel, Select, MenuItem, Box, Chip, FormControlLabel, Switch } from '@mui/material';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import ImageIcon from '@mui/icons-material/Image';
import AuthImage from '../../components/common/AuthImage';
import GotoMapsButton from './GotoMapsButton';
import { MapItemDto, getMapImageUrlSized } from '../../api/maps';
import { EncounterSummary, EncounterDifficulty } from '../../api/encounters';

export interface CombatHeaderProps {
  /** Lista de mapas disponibles */
  maps: MapItemDto[];
  /** ID del mapa activo (opcional) */
  activeMapId?: string | null;
  /** Callback para seleccionar mapa */
  setActiveMapId: (id: string) => void;

  /** Lista de encuentros disponibles */
  encounters: EncounterSummary[];
  /** ID del encuentro activo (opcional) */
  activeEncounterId?: string | null;
  /** Callback para seleccionar encuentro */
  onSelectEncounter: (id: string) => void;

  /** Preferencia de música de encuentro */
  prioritizeEncounterMusic: boolean;
  /** Cambiar preferencia de música de encuentro */
  setPrioritizeEncounterMusic: (v: boolean) => void;

  /** Estado de niebla de guerra */
  fogEnabled: boolean;
  /** Cambiar niebla de guerra */
  setFogEnabled: (v: boolean) => void;

  /** Mostrar tira de iniciativa en Skyline */
  showInitiativeStrip: boolean;
  /** Callback al cambiar tira de iniciativa */
  onToggleInitiativeStrip: (v: boolean) => void;
}

const difficultyColor: Record<EncounterDifficulty, 'default' | 'success' | 'warning' | 'error'> = {
  'Fácil': 'success',
  'Medio': 'default',
  'Difícil': 'warning',
  'Mortal': 'error',
};

/**
 * Encabezado de la vista de combate con selectores de mapa y encuentro
 * y toggles de configuración (música, niebla, tira de iniciativa).
 */
const CombatHeader: React.FC<CombatHeaderProps> = ({
  maps,
  activeMapId,
  setActiveMapId,
  encounters,
  activeEncounterId,
  onSelectEncounter,
  prioritizeEncounterMusic,
  setPrioritizeEncounterMusic,
  fogEnabled,
  setFogEnabled,
  showInitiativeStrip,
  onToggleInitiativeStrip,
}) => {
  return (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
      <Typography variant="h6">Combate</Typography>
      <FormControl size="small" sx={{ minWidth: 240 }}>
        <InputLabel id="select-map-inline-label">Mapa</InputLabel>
        <Select
          labelId="select-map-inline-label"
          label="Mapa"
          value={(activeMapId && maps.some(m => m.id === activeMapId)) ? activeMapId : ''}
          onChange={(e) => setActiveMapId(e.target.value as string)}
          displayEmpty
          renderValue={(val) => {
            const m = maps.find((x) => x.id === val);
            if (!m) return <em>Mapa activo</em> as any;
            return (
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 24, height: 24, borderRadius: 0.5, overflow: 'hidden', bgcolor: 'action.hover', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m.imageAvailable ? (
                    <AuthImage src={getMapImageUrlSized(m.id, 'thumb')} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onErrorIcon={<ImageIcon fontSize="small" />} />
                  ) : (
                    <ImageIcon fontSize="small" />
                  )}
                </Box>
                <Typography variant="body2" noWrap>{m.name}</Typography>
                {m.musicConfig && <LibraryMusicIcon fontSize="small" color="primary" />}
              </Stack>
            );
          }}
        >
          {maps.length === 0 && (
            <MenuItem value="" disabled>
              <em>Sin mapas</em>
            </MenuItem>
          )}
          {maps.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 24, height: 24, borderRadius: 0.5, overflow: 'hidden', bgcolor: 'action.hover', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m.imageAvailable ? (
                    <AuthImage src={getMapImageUrlSized(m.id, 'thumb')} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onErrorIcon={<ImageIcon fontSize="small" />} />
                  ) : (
                    <ImageIcon fontSize="small" />
                  )}
                </Box>
                <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>{m.name}</Typography>
                {m.musicConfig && <LibraryMusicIcon fontSize="small" color="primary" />}
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 260 }}>
        <InputLabel id="select-encounter-inline-label">Encuentro</InputLabel>
        <Select
          labelId="select-encounter-inline-label"
          label="Encuentro"
          value={(activeEncounterId && encounters.some(e => e.id === activeEncounterId)) ? activeEncounterId : ''}
          onChange={(e) => onSelectEncounter(e.target.value as string)}
          displayEmpty
          renderValue={(val) => {
            const chosen = encounters.find((e) => e.id === val);
            if (!chosen) return <em>Sin encuentro</em> as any;
            return (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" noWrap>{chosen.name}</Typography>
                <Chip size="small" label={chosen.difficulty} color={difficultyColor[chosen.difficulty]} />
              </Stack>
            );
          }}
        >
          {encounters.length === 0 && (
            <MenuItem value="" disabled>
              <em>Sin encuentros</em>
            </MenuItem>
          )}
          {encounters.map((enc) => (
            <MenuItem key={enc.id} value={enc.id}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>{enc.name}</Typography>
                <Chip size="small" label={enc.difficulty} color={difficultyColor[enc.difficulty]} />
                <Typography variant="caption" color="text.secondary">{enc.participants.length} integrantes</Typography>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={<Switch checked={prioritizeEncounterMusic} onChange={(_, v) => setPrioritizeEncounterMusic(v)} />}
        label="Priorizar música de encuentro"
      />
      <FormControlLabel
        control={<Switch checked={fogEnabled} onChange={(_, v) => setFogEnabled(v)} />}
        label="Niebla de guerra"
      />
      <FormControlLabel
        control={<Switch checked={showInitiativeStrip} onChange={(_, v) => onToggleInitiativeStrip(v)} />}
        label="Tira de iniciativa en Skyline"
      />

      <GotoMapsButton />
    </Stack>
  );
};

export default CombatHeader;
