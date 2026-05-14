import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import ShortcutEditor from '../components/shortcuts/ShortcutEditor';
import { getCurrentUser } from '../utils/getCurrentUser';
import { useShortcuts } from '../contexts/ShortcutsContext';
import ShortcutButton from '../components/shortcuts/ShortcutButton';
import { DEFAULT_SHORTCUT_SCHEMA_VERSION, type ShortcutActionDefinition, type ShortcutItem, type ShortcutPayload } from '../types/shortcuts';

const EMPTY_ACTION: ShortcutActionDefinition = { kind: 'toggleState', payload: {} };

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some((player: any) => player?.user?.id === userId && player?.status === 'active' && player?.role === 'master');
}

const defaultDraft = (): ShortcutPayload => ({
  scope: 'campaign',
  campaignId: null,
  schemaVersion: DEFAULT_SHORTCUT_SCHEMA_VERSION,
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

/**
 * CRUD page for user-defined shortcuts.
 */
const ShortcutsPage = () => {
  const { activeCampaign } = useActiveCampaign();
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);
  const { shortcuts, soundEffects, createShortcut, updateShortcut, deleteShortcut, executeShortcut, testShortcutDraft } = useShortcuts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShortcutItem | null>(null);
  const [draft, setDraft] = useState<ShortcutPayload>(defaultDraft());

  const campaignId = activeCampaign?.id ?? null;

  const openCreate = () => {
    setEditing(null);
    setDraft({
      ...defaultDraft(),
      scope: campaignId ? 'campaign' : 'global',
      campaignId,
    });
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
      scope: shortcut.scope || (campaignId ? 'campaign' : 'global'),
      campaignId: shortcut.campaignId ?? campaignId,
      schemaVersion: shortcut.schemaVersion ?? DEFAULT_SHORTCUT_SCHEMA_VERSION,
      sortOrder: shortcut.sortOrder,
      sidebarPanelOrder: shortcut.sidebarPanelOrder,
      hotbarOrder: shortcut.hotbarOrder,
      actions: shortcut.actions.length
        ? shortcut.actions.map((action) => ({ ...action, payload: action.payload ?? action.config ?? {} }))
        : [EMPTY_ACTION],
    });
    setOpen(true);
  };

  const handleSave = async (payload: ShortcutPayload) => {
    if (editing) await updateShortcut(editing.id, payload);
    else await createShortcut(payload);
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

      <ShortcutEditor
        open={open}
        editing={editing}
        initialDraft={draft}
        shortcuts={shortcuts}
        soundEffects={soundEffects}
        campaignId={campaignId}
        onClose={() => setOpen(false)}
        onSave={handleSave}
        onTest={testShortcutDraft}
      />
    </Box>
  );
};

export default ShortcutsPage;