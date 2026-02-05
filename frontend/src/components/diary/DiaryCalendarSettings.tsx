import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { Box, Button, Card, CardContent, IconButton, Stack, TextField, Typography } from '@mui/material';
import type { DiaryCalendarConfig } from '../../api/diary/diaryApi';

export interface DiaryCalendarSettingsProps {
  config: DiaryCalendarConfig;
  onChange: (config: DiaryCalendarConfig) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

/**
 * Master-only calendar configuration editor.
 */
export function DiaryCalendarSettings({ config, onChange, onSave, isSaving }: DiaryCalendarSettingsProps) {
  const yearTemplate = (config.yearLabelTemplate ?? '').trim();
  const yearPreview = yearTemplate && yearTemplate.includes('{year}')
    ? yearTemplate.split('{year}').join(String(config.currentYear))
    : `Año ${config.currentYear}`;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5">Configuración del calendario</Typography>

          <TextField
            label="Año actual"
            type="number"
            size="small"
            value={config.currentYear}
            onChange={(e) => onChange({ ...config, currentYear: Number(e.target.value) })}
            sx={{ maxWidth: 240 }}
          />

          <TextField
            label="Formato del año"
            size="small"
            value={config.yearLabelTemplate ?? ''}
            placeholder="Año {year}"
            helperText={
              <>
                Usa <code>{'{year}'}</code> como marcador. Vista previa: <strong>{yearPreview}</strong>
              </>
            }
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                ...config,
                yearLabelTemplate: v.trim() ? v : undefined,
              });
            }}
            sx={{ maxWidth: 520 }}
          />

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Meses</Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() =>
                  onChange({
                    ...config,
                    months: [...config.months, { name: `Mes ${config.months.length + 1}`, days: 30 }],
                  })
                }
              >
                Añadir mes
              </Button>
            </Stack>

            <Stack spacing={1}>
              {config.months.map((m, idx) => (
                <Stack key={idx} direction="row" gap={1} alignItems="center">
                  <TextField
                    size="small"
                    label={`Nombre (mes ${idx + 1})`}
                    value={m.name}
                    onChange={(e) => {
                      const months = [...config.months];
                      months[idx] = { ...months[idx], name: e.target.value };
                      onChange({ ...config, months });
                    }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Días"
                    value={m.days}
                    onChange={(e) => {
                      const months = [...config.months];
                      months[idx] = { ...months[idx], days: Math.max(1, Number(e.target.value)) };
                      onChange({ ...config, months });
                    }}
                    sx={{ width: 120 }}
                  />
                  <IconButton
                    aria-label="Eliminar mes"
                    onClick={() => {
                      const months = config.months.filter((_, i) => i !== idx);
                      onChange({ ...config, months: months.length ? months : [{ name: 'Mes 1', days: 30 }] });
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Días de la semana</Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => onChange({ ...config, weekDays: [...config.weekDays, { name: `Día ${config.weekDays.length + 1}` }] })}
              >
                Añadir día
              </Button>
            </Stack>

            <Stack spacing={1}>
              {config.weekDays.map((d, idx) => (
                <Stack key={idx} direction="row" gap={1} alignItems="center">
                  <TextField
                    size="small"
                    label={`Nombre (día ${idx + 1})`}
                    value={d.name}
                    onChange={(e) => {
                      const weekDays = [...config.weekDays];
                      weekDays[idx] = { ...weekDays[idx], name: e.target.value };
                      onChange({ ...config, weekDays });
                    }}
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    aria-label="Eliminar día"
                    onClick={() => {
                      const weekDays = config.weekDays.filter((_, i) => i !== idx);
                      onChange({ ...config, weekDays: weekDays.length ? weekDays : [{ name: 'Día 1' }] });
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Stack direction="row" justifyContent="flex-end">
            <Button startIcon={<SaveIcon />} variant="contained" onClick={onSave} disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Guardar calendario'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
