import React, { useEffect, useState } from 'react';
import { Alert, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { getSkylineOverlaySettings, setSkylineOverlaySettings } from '../../api/campaigns/skylineOverlay';

export interface SkylineSongTitleSettingProps {
  campaignId: string;
}

/**
 * Toggle to show/hide the current song title in the Skyline projection overlay.
 *
 * Responsibilities:
 * - Load persisted Skyline overlay settings for the campaign.
 * - Update them on toggle.
 * - Broadcast changes to other windows via localStorage + BroadcastChannel.
 */
export const SkylineSongTitleSetting: React.FC<SkylineSongTitleSettingProps> = ({ campaignId }) => {
  const [showSongTitle, setShowSongTitle] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!campaignId) return;
      setError(null);
      setIsLoading(true);
      try {
        const settings = await getSkylineOverlaySettings(campaignId);
        if (!disposed) setShowSongTitle(!!settings.showSongTitle);
      } catch {
        // keep silent; this is a convenience toggle
      } finally {
        if (!disposed) setIsLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [campaignId]);

  const broadcast = (nextValue: boolean) => {
    // Storage event for projection windows.
    try {
      localStorage.setItem('app.skyline.settingsUpdated', JSON.stringify({ campaignId, showSongTitle: nextValue, at: Date.now() }));
    } catch {}

    // Fast-sync for Electron/web multi-window.
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('campaign-sync');
        bc.postMessage({ type: 'skylineSettingsChanged', campaignId, settings: { showSongTitle: nextValue } });
        bc.close();
      }
    } catch {}
  };

  const handleChange = async (nextValue: boolean) => {
    setShowSongTitle(nextValue);
    setError(null);

    try {
      await setSkylineOverlaySettings(campaignId, { showSongTitle: nextValue });
      broadcast(nextValue);
    } catch (e: any) {
      setShowSongTitle((prev) => !prev);
      setError(e?.response?.data?.message || 'No se pudo actualizar Skyline');
    }
  };

  return (
    <Stack spacing={0.5}>
      {error ? <Alert severity="warning">{error}</Alert> : null}
      <FormControlLabel
        control={<Switch checked={showSongTitle} onChange={(_, v) => handleChange(v)} />}
        label="Mostrar título en Skyline"
        disabled={isLoading}
      />
      <Typography variant="caption" color="text.secondary">
        Muestra el título de la canción actual en la proyección Skyline.
      </Typography>
    </Stack>
  );
};
