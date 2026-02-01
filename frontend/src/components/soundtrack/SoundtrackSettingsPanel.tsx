import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSoundtrackMode } from '../../hooks/useSoundtrackMode';
import { SongHistoryCard } from './SongHistoryCard';
import { SkylineSongTitleSetting } from './SkylineSongTitleSetting';

export interface SoundtrackSettingsPanelProps {
  campaignId: string;
  canClearHistory?: boolean;
}

/**
 * Soundtrack settings panel.
 *
 * - Collapsible container for soundtrack-related settings.
 * - Includes a nested, collapsible playback history.
 */
export const SoundtrackSettingsPanel: React.FC<SoundtrackSettingsPanelProps> = ({ campaignId, canClearHistory = false }) => {
  const { mode, isLoading, error, setMode } = useSoundtrackMode(campaignId);

  return (
    <Accordion defaultExpanded disableGutters elevation={0} sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">Ajustes</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
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

          <Accordion defaultExpanded={false} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Historial de reproducción</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <SongHistoryCard campaignId={campaignId} variant="plain" canClear={canClearHistory} />
            </AccordionDetails>
          </Accordion>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
