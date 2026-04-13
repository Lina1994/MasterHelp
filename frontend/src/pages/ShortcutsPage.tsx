import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BackspaceIcon from '@mui/icons-material/Backspace';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import { useShortcuts } from '../contexts/ShortcutsContext';
import ShortcutButton from '../components/shortcuts/ShortcutButton';
import { hotkeyFromKeyboardEvent } from '../types/shortcuts';
import type { ShortcutActionDefinition, ShortcutItem, ShortcutMode, ShortcutPayload } from '../types/shortcuts';

const EMPTY_ACTION: ShortcutActionDefinition = {
  kind: 'toggleState',
  config: {},
};

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some((player: any) => player?.user?.id === userId && player?.status === 'active' && player?.role === 'master');
}

const defaultDraft = (): ShortcutPayload => ({
  name: '',
  description: '',
  icon: '',
  imageUrl: '',
  hotkey: '',
  mode: 'button',
  temporaryDurationMs: 5000,
  activeColor: '#2e7d32',
  inactiveColor: '#455a64',
  showOnHome: true,
  showInSidebarPanel: true,
  showInHotbar: false,
  sortOrder: 0,
  sidebarPanelOrder: 0,
  hotbarOrder: 0,
  actions: [EMPTY_ACTION],
});

const formatHotkeyLabel = (hotkey: string): string => {
  if (!hotkey) return '';
  return hotkey
    .split('+')
    .filter(Boolean)
    .map((segment) => segment.length === 1 ? segment.toUpperCase() : segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('+');
};

/**
 * CRUD page for user-defined shortcuts.
 */
const ShortcutsPage = () => {
  const { activeCampaign } = useActiveCampaign();
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);
  const { shortcuts, soundEffects, createShortcut, updateShortcut, deleteShortcut, executeShortcut } = useShortcuts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShortcutItem | null>(null);
  const [draft, setDraft] = useState<ShortcutPayload>(defaultDraft());

  const effectOptions = useMemo(() => soundEffects.map((effect) => ({ value: effect.id, label: effect.name })), [soundEffects]);

  const openCreate = () => {
    setEditing(null);
    setDraft(defaultDraft());
    setOpen(true);
  };

  const openEdit = (shortcut: ShortcutItem) => {
    setEditing(shortcut);
    setDraft({
      name: shortcut.name,
      description: shortcut.description ?? '',
      icon: shortcut.icon ?? '',
      imageUrl: shortcut.imageUrl ?? '',
      hotkey: shortcut.hotkey ?? '',
      mode: shortcut.mode,
      temporaryDurationMs: shortcut.temporaryDurationMs ?? 5000,
      activeColor: shortcut.activeColor ?? '#2e7d32',
      inactiveColor: shortcut.inactiveColor ?? '#455a64',
      showOnHome: shortcut.showOnHome,
      showInSidebarPanel: shortcut.showInSidebarPanel,
      showInHotbar: shortcut.showInHotbar,
      sortOrder: shortcut.sortOrder,
      sidebarPanelOrder: shortcut.sidebarPanelOrder,
      hotbarOrder: shortcut.hotbarOrder,
      actions: shortcut.actions.length ? shortcut.actions : [EMPTY_ACTION],
    });
    setOpen(true);
  };

  const updateAction = (index: number, next: ShortcutActionDefinition) => {
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.map((action, actionIndex) => (actionIndex === index ? next : action)),
    }));
  };

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    const payload: ShortcutPayload = {
      ...draft,
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
      icon: draft.icon?.trim() || null,
      imageUrl: draft.imageUrl?.trim() || null,
      hotkey: draft.hotkey?.trim() || null,
      mode: draft.mode as ShortcutMode,
      actions: draft.actions.filter((action) => action.kind === 'toggleState' || action.config.effectId),
    };
    if (editing) await updateShortcut(editing.id, payload);
    else await createShortcut(payload);
    setOpen(false);
  };

  const handleHotkeyCapture = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Backspace' || event.key === 'Delete') {
      setDraft((prev) => ({ ...prev, hotkey: '' }));
      return;
    }

    if (event.key === 'Escape') {
      return;
    }

    const nextHotkey = hotkeyFromKeyboardEvent(event.nativeEvent);
    if (!nextHotkey) return;

    setDraft((prev) => ({ ...prev, hotkey: nextHotkey }));
  };

  if (!isMaster) {
    return <Alert severity="warning">Los atajos solo están disponibles para el máster de la campaña activa.</Alert>;
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4">Atajos</Typography>
          <Typography variant="body2" color="text.secondary">
            Configura botones rápidos, macros sencillas y disparadores con teclado.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
          Nuevo atajo
        </Button>
      </Stack>

      <Grid container spacing={2}>
        {shortcuts.map((shortcut) => (
          <Grid size={{ xs: 12, md: 6, xl: 4 }} key={shortcut.id}>
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <ShortcutButton shortcut={shortcut} onClick={executeShortcut} />
                <Stack direction="row" spacing={0.5}>
                  <IconButton onClick={() => executeShortcut(shortcut)}><PlayArrowIcon /></IconButton>
                  <IconButton onClick={() => openEdit(shortcut)}><EditIcon /></IconButton>
                  <IconButton color="error" onClick={() => deleteShortcut(shortcut.id)}><DeleteIcon /></IconButton>
                </Stack>
              </Stack>
              {shortcut.description ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {shortcut.description}
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {shortcut.actions.map((action) => action.kind === 'playSoundEffect' ? 'Efecto de sonido' : 'Toggle').join(' + ')}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Editar atajo' : 'Nuevo atajo'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nombre" value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} fullWidth />
            <TextField label="Descripción" value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} fullWidth />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField label="Icono / emoji" value={draft.icon} onChange={(event) => setDraft((prev) => ({ ...prev, icon: event.target.value }))} fullWidth />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField label="URL de imagen" value={draft.imageUrl} onChange={(event) => setDraft((prev) => ({ ...prev, imageUrl: event.target.value }))} fullWidth />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Tecla / combinación"
                  value={formatHotkeyLabel(draft.hotkey || '')}
                  onKeyDown={handleHotkeyCapture}
                  fullWidth
                  placeholder="Pulsa la combinación"
                  helperText="Haz foco aquí y pulsa la combinación. Usa Backspace para limpiar."
                  InputProps={{
                    readOnly: true,
                    endAdornment: draft.hotkey ? (
                      <IconButton size="small" onClick={() => setDraft((prev) => ({ ...prev, hotkey: '' }))}>
                        <BackspaceIcon fontSize="small" />
                      </IconButton>
                    ) : undefined,
                  }}
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="shortcut-mode-label">Modo</InputLabel>
                  <Select
                    labelId="shortcut-mode-label"
                    label="Modo"
                    value={draft.mode}
                    onChange={(event) => setDraft((prev) => ({ ...prev, mode: event.target.value as ShortcutMode }))}
                  >
                    <MenuItem value="button">Botón</MenuItem>
                    <MenuItem value="toggle">Toggle</MenuItem>
                    <MenuItem value="temporary">Temporal</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField type="number" label="Duración temporal (ms)" value={draft.temporaryDurationMs ?? 5000} onChange={(event) => setDraft((prev) => ({ ...prev, temporaryDurationMs: Number(event.target.value) }))} fullWidth disabled={draft.mode !== 'temporary'} />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField type="color" label="Color activo" value={draft.activeColor} onChange={(event) => setDraft((prev) => ({ ...prev, activeColor: event.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField type="color" label="Color inactivo" value={draft.inactiveColor} onChange={(event) => setDraft((prev) => ({ ...prev, inactiveColor: event.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="subtitle2">Acciones</Typography>
                {draft.actions.map((action, index) => (
                  <Grid container spacing={2} key={`${action.kind}-${index}`}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth>
                        <InputLabel id={`action-kind-${index}`}>Tipo</InputLabel>
                        <Select
                          labelId={`action-kind-${index}`}
                          label="Tipo"
                          value={action.kind}
                          onChange={(event) => updateAction(index, { kind: event.target.value as ShortcutActionDefinition['kind'], config: event.target.value === 'playSoundEffect' ? { effectId: '', volume: 1, loopMode: 'once', uniquePerEffect: true } : {} })}
                        >
                          <MenuItem value="toggleState">Toggle visual</MenuItem>
                          <MenuItem value="playSoundEffect">Efecto de sonido</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    {action.kind === 'playSoundEffect' ? (
                      <>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <FormControl fullWidth>
                            <InputLabel id={`effect-select-${index}`}>Efecto</InputLabel>
                            <Select
                              labelId={`effect-select-${index}`}
                              label="Efecto"
                              value={(action.config.effectId as string) || ''}
                              onChange={(event) => updateAction(index, { ...action, config: { ...action.config, effectId: event.target.value } })}
                            >
                              {effectOptions.map((effect) => (
                                <MenuItem key={effect.value} value={effect.value}>{effect.label}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, md: 2 }}>
                          <TextField type="number" label="Volumen" inputProps={{ min: 0, max: 1, step: 0.1 }} value={String(action.config.volume ?? 1)} onChange={(event) => updateAction(index, { ...action, config: { ...action.config, volume: Number(event.target.value) } })} fullWidth />
                        </Grid>
                        <Grid size={{ xs: 12, md: 2 }}>
                          <FormControl fullWidth>
                            <InputLabel id={`loop-mode-${index}`}>Bucle</InputLabel>
                            <Select
                              labelId={`loop-mode-${index}`}
                              label="Bucle"
                              value={(action.config.loopMode as string) || 'once'}
                              onChange={(event) => updateAction(index, { ...action, config: { ...action.config, loopMode: event.target.value } })}
                            >
                              <MenuItem value="once">Una vez</MenuItem>
                              <MenuItem value="continuous">Continuo</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </>
                    ) : (
                      <Grid size={{ xs: 12, md: 8 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ pt: 1.5 }}>
                          Esta acción solo usa el estado activo/inactivo del propio atajo.
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                ))}
                <Button variant="text" onClick={() => setDraft((prev) => ({ ...prev, actions: [...prev.actions, EMPTY_ACTION] }))}>
                  Añadir acción
                </Button>
              </Stack>
            </Paper>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControlLabel control={<Checkbox checked={Boolean(draft.showOnHome)} onChange={(_, checked) => setDraft((prev) => ({ ...prev, showOnHome: checked }))} />} label="Mostrar en Inicio" />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControlLabel control={<Checkbox checked={Boolean(draft.showInSidebarPanel)} onChange={(_, checked) => setDraft((prev) => ({ ...prev, showInSidebarPanel: checked }))} />} label="Mostrar en panel lateral" />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControlLabel control={<Checkbox checked={Boolean(draft.showInHotbar)} onChange={(_, checked) => setDraft((prev) => ({ ...prev, showInHotbar: checked }))} />} label="Mostrar en hotbar" />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ShortcutsPage;