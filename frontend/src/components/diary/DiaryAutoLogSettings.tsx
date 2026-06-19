import React, { useEffect, useState } from 'react';
import { Alert, Card, CardContent, CircularProgress, Divider, Stack, Switch, Typography } from '@mui/material';
import { AutoLogSettings, getAutoLogSettings, setAutoLogSettings } from '../../api/campaigns/autoLogSettings';

interface DiaryAutoLogSettingsProps {
  campaignId: string;
}

/** Per-category toggles shown under the master switch. */
const CATEGORY_TOGGLES: Array<{ key: keyof Omit<AutoLogSettings, 'enabled'>; label: string; help: string }> = [
  { key: 'logPlaces', label: 'Lugares visitados', help: 'Cuando cambias el mapa activo.' },
  { key: 'logCharacters', label: 'Personajes encontrados', help: 'Cuando proyectas un PNJ en la ventana Skyline.' },
  { key: 'logQuests', label: 'Misiones', help: 'Cuando se acepta o completa una misión.' },
  { key: 'logCombat', label: 'Combates', help: 'Cuando comienza o termina un combate.' },
];

/**
 * Settings card for the automatic adventure log.
 *
 * Lets the master enable automatic diary logging and pick which categories
 * are recorded. Entries are only created when a diary session is active and
 * are appended to a "Registro de aventuras" item on the current campaign day.
 */
export const DiaryAutoLogSettings: React.FC<DiaryAutoLogSettingsProps> = ({ campaignId }) => {
  const [settings, setSettings] = useState<AutoLogSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAutoLogSettings(campaignId)
      .then((s) => { if (!cancelled) setSettings(s); })
      .catch(() => { if (!cancelled) setError('No se pudieron cargar los ajustes de registro automático.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [campaignId]);

  /**
   * Persists a single setting change optimistically, reverting on failure.
   */
  const updateSetting = async (patch: Partial<AutoLogSettings>) => {
    if (!settings) return;
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    setError(null);
    try {
      await setAutoLogSettings(campaignId, patch);
    } catch {
      setSettings(previous);
      setError('No se pudo guardar el cambio.');
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">Registro automático</Typography>
          <Typography variant="body2" color="text.secondary">
            Crea y edita automáticamente una entrada llamada «Registro de aventuras» en el día actual de la campaña.
            Solo se registra si hay una sesión activa.
          </Typography>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 2 }}><CircularProgress size={24} /></Stack>
          ) : settings ? (
            <>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Typography variant="body2" fontWeight={600}>Activar registro automático</Typography>
                <Switch
                  checked={settings.enabled}
                  onChange={(_, v) => updateSetting({ enabled: v })}
                />
              </Stack>

              <Divider />

              {CATEGORY_TOGGLES.map(({ key, label, help }) => (
                <Stack key={key} direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography variant="body2">{label}</Typography>
                    <Typography variant="caption" color="text.secondary">{help}</Typography>
                  </Stack>
                  <Switch
                    checked={settings[key]}
                    disabled={!settings.enabled}
                    onChange={(_, v) => updateSetting({ [key]: v } as Partial<AutoLogSettings>)}
                  />
                </Stack>
              ))}
            </>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default DiaryAutoLogSettings;
