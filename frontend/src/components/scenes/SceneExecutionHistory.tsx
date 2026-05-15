import React, { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { listSceneExecutions } from '../../api/scenes';
import type { SceneExecution } from '../../types/scenes';

const STATUS_CHIP: Record<string, { label: string; color: 'success' | 'error' | 'warning' | 'default' | 'info' }> = {
  completed: { label: 'Completada', color: 'success' },
  failed:    { label: 'Error',      color: 'error' },
  cancelled: { label: 'Cancelada',  color: 'default' },
  running:   { label: 'En curso',   color: 'info' },
  queued:    { label: 'En cola',    color: 'warning' },
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog that displays the last 25 scene execution records.
 */
const SceneExecutionHistory: React.FC<Props> = ({ open, onClose }) => {
  const [executions, setExecutions] = useState<SceneExecution[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listSceneExecutions()
      .then(setExecutions)
      .catch(() => setExecutions([]))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Historial de ejecuciones</Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : executions.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            Sin ejecuciones recientes.
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Escena</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Inicio</TableCell>
                  <TableCell>Fin</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                  <TableCell align="right">Comandos</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {executions.map((ex) => {
                  const chip = STATUS_CHIP[ex.status] ?? { label: ex.status, color: 'default' };
                  return (
                    <TableRow key={ex.id} hover>
                      <TableCell>
                        <Tooltip title={ex.id}>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                            {ex.scene?.name ?? '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <StatusIcon status={ex.status} />
                          <Chip label={chip.label} color={chip.color} size="small" />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{formatDate(ex.startedAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{formatDate(ex.finishedAt)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        {ex.summary?.totalActions ?? '—'}
                      </TableCell>
                      <TableCell align="right">
                        {ex.summary?.emittedCommands ?? '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
};

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'completed') return <CheckCircleOutlineIcon fontSize="small" color="success" />;
  if (status === 'failed')    return <ErrorOutlineIcon fontSize="small" color="error" />;
  return <HourglassEmptyIcon fontSize="small" color="disabled" />;
};

export default SceneExecutionHistory;
