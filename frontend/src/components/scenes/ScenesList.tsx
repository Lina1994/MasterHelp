import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HistoryIcon from '@mui/icons-material/History';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import {
  listScenes,
  getScene,
  createScene,
  updateScene,
  deleteScene,
  executeScene,
} from '../../api/scenes';
import type { SceneLite, Scene, ScenePayload } from '../../types/scenes';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import ConfirmDialog from '../common/ConfirmDialog';
import SceneFormDialog from './SceneFormDialog';
import SceneExecutionHistory from './SceneExecutionHistory';

/**
 * Main scenes list component — CRUD + execution.
 */
export const ScenesList: React.FC = () => {
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id ?? null;

  const [scenes, setScenes] = useState<SceneLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form dialog
  const [openForm, setOpenForm] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<SceneLite | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Execution
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);

  // History panel
  const [showHistory, setShowHistory] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listScenes(campaignId ? { campaignId } : undefined);
      setScenes(data);
    } catch {
      // silently fail; empty state shown
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenCreate = () => {
    setEditingScene(null);
    setOpenForm(true);
  };

  const handleOpenEdit = async (scene: SceneLite) => {
    try {
      const full = await getScene(scene.id);
      setEditingScene(full);
      setOpenForm(true);
    } catch {
      // ignore
    }
  };

  const handleSave = async (payload: ScenePayload, id?: string) => {
    if (id) {
      await updateScene(id, payload);
    } else {
      await createScene(payload);
    }
    await load();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteScene(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExecute = async (scene: SceneLite) => {
    setExecutingId(scene.id);
    setExecuteError(null);
    try {
      const result = await executeScene(scene.id);
      // Dispatch execution plan to runtime bridge for timed orchestration.
      window.dispatchEvent(new CustomEvent('scene:runtime-execute', { detail: result }));
    } catch (err: any) {
      setExecuteError(err?.response?.data?.message ?? err?.message ?? 'Error al ejecutar.');
    } finally {
      setExecutingId(null);
    }
  };

  const filtered = scenes.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction="row" spacing={2} alignItems="center" mb={2} flexWrap="wrap">
        <TextField
          label="Buscar escenas"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flex: 1, minWidth: 180 }}
        />
        <Button
          variant="outlined"
          startIcon={<HistoryIcon />}
          onClick={() => setShowHistory(true)}
          size="small"
        >
          Historial
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
        >
          Nueva escena
        </Button>
      </Stack>

      {executeError && (
        <Typography variant="body2" color="error" mb={1}>
          {executeError}
        </Typography>
      )}

      {/* Content */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box textAlign="center" py={6}>
          <TheaterComedyIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            {searchTerm ? 'Sin resultados.' : 'Aún no hay escenas. Crea la primera.'}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {filtered.map((scene) => (
            <Box key={scene.id}>
              <SceneCard
                scene={scene}
                executing={executingId === scene.id}
                onEdit={() => handleOpenEdit(scene)}
                onDelete={() => setDeleteTarget(scene)}
                onExecute={() => handleExecute(scene)}
              />
            </Box>
          ))}
        </Box>
      )}

      {/* Form dialog */}
      <SceneFormDialog
        open={openForm}
        editing={editingScene}
        campaignId={campaignId}
        onClose={() => setOpenForm(false)}
        onSave={handleSave}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar escena"
        message={`¿Eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmColor="error"
        confirmDisabled={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* History panel */}
      <SceneExecutionHistory open={showHistory} onClose={() => setShowHistory(false)} />
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Scene card
// ---------------------------------------------------------------------------

interface SceneCardProps {
  scene: SceneLite;
  executing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onExecute: () => void;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, executing, onEdit, onDelete, onExecute }) => (
  <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <CardHeader
      avatar={<TheaterComedyIcon color="action" />}
      title={
        <Typography variant="subtitle1" fontWeight={600} noWrap>
          {scene.name}
        </Typography>
      }
      subheader={
        <Chip
          label={scene.scope === 'global' ? 'Global' : 'Campaña'}
          size="small"
          color={scene.scope === 'global' ? 'default' : 'primary'}
          variant="outlined"
          sx={{ mt: 0.5 }}
        />
      }
      action={
        <Stack direction="row">
          <Tooltip title="Editar">
            <IconButton size="small" onClick={onEdit}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" color="error" onClick={onDelete}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      }
    />

    {scene.description && (
      <CardContent sx={{ pt: 0, pb: 0, flex: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {scene.description}
        </Typography>
      </CardContent>
    )}

    <CardActions sx={{ mt: 'auto' }}>
      <Button
        size="small"
        variant="contained"
        color="success"
        startIcon={executing ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
        onClick={onExecute}
        disabled={executing}
        sx={{ ml: 'auto' }}
      >
        {executing ? 'Ejecutando…' : 'Ejecutar'}
      </Button>
    </CardActions>
  </Card>
);

export default ScenesList;
