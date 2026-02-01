import React from 'react';
import { Alert, Card, CardContent, FormControl, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import { useSoundtrackMode } from '../../hooks/useSoundtrackMode';

export interface SoundtrackSettingsCardProps {
  campaignId: string;
}

/**
 * Soundtrack settings card.
 *
 * Allows switching between:
 * - Automatic: map/encounter/combat can auto-apply configured music/SFX.
 * - Manual: no automatic changes; only manual playback actions.
 */
export const SoundtrackSettingsCard: React.FC<SoundtrackSettingsCardProps> = ({ campaignId }) => {
  const { mode, isLoading, error, setMode } = useSoundtrackMode(campaignId);

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">Ajustes</Typography>
          <Typography variant="body2" color="text.secondary">
            En modo manual, no se aplicarán canciones ni efectos automáticamente por mapas, encuentros o combates.
          </Typography>

          {error ? <Alert severity="warning">{error}</Alert> : null}

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
        </Stack>
      </CardContent>
    </Card>
  );
};
