import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSoundtrackMode } from '../../hooks/useSoundtrackMode';
import { useStopSfxOnMapChange } from '../../hooks/useStopSfxOnMapChange';
import { SongHistoryCard } from './SongHistoryCard';
import { SkylineSongTitleSetting } from './SkylineSongTitleSetting';

export interface SoundtrackSettingsPanelProps {
  campaignId: string;
  canClearHistory?: boolean;
  usage?: { totalSize: number; count: number } | null;
  onClose?: () => void;
}

/**
 * Soundtrack settings panel.
 *
 * - Collapsible container for soundtrack-related settings.
 * - Includes a nested, collapsible playback history.
 */
export const SoundtrackSettingsPanel: React.FC<SoundtrackSettingsPanelProps> = ({
  campaignId,
  canClearHistory = false,
  usage,
  onClose,
}) => {
  const { mode, isLoading, error, setMode } = useSoundtrackMode(campaignId);
  const { stopSfxOnMapChange, setStopSfxOnMapChange } = useStopSfxOnMapChange();

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Ajustes</Typography>
            {onClose ? (
              <IconButton size="small" onClick={onClose} aria-label="Cerrar ajustes">
                <CloseIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {usage
              ? `${(usage.totalSize / 1024 / 1024).toFixed(2)} MB • ${usage.count} pistas`
              : 'Calculando uso...'}
          </Typography>
          <Divider />

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              En modo manual, no se aplicarán canciones ni efectos automáticamente por mapas, encuentros o combates.
            </Typography>

            {error ? <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert> : null}

            <FormControl>
              <RadioGroup
                row
                value={mode}
                onChange={async (_, v) => {
                  if (v === 'manual' || v === 'automatic') await setMode(v);
                }}
              >
                <FormControlLabel value="automatic" control={<Radio />} label="Automático" disabled={isLoading} />
                <FormControlLabel value="manual" control={<Radio />} label="Manual" disabled={isLoading} />
              </RadioGroup>
            </FormControl>
          </Box>

          <Box>
            <SkylineSongTitleSetting campaignId={campaignId} />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={stopSfxOnMapChange}
                onChange={(_, checked) => setStopSfxOnMapChange(checked)}
                size="small"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Detener SFX al cambiar a mapa sin efectos</Typography>
                <Typography variant="caption" color="text.secondary">
                  Cuando cambies a un mapa sin presets SFX configurados, los efectos del mapa anterior se detendrán. La música no se ve afectada.
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mt: 0.5 }}
          />

          <Accordion defaultExpanded={false} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Historial de reproducción</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <SongHistoryCard campaignId={campaignId} variant="plain" canClear={canClearHistory} />
            </AccordionDetails>
          </Accordion>
        </Stack>
      </CardContent>
    </Card>
  );
};
