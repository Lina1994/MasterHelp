import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCampaignId } from '../../hooks/useCampaignId';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../../utils/getCurrentUser';
import {
  listQuests,
  deleteQuest,
  updateQuest,
  QuestPayload,
  QuestStatus,
} from '../../api/quests';
import {
  Box,
  Button,
  Stack,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { QuestFormDialog } from './QuestFormDialog';
import { QuestCard } from './QuestCard';

export const QuestList: React.FC = () => {
  const campaignId = useCampaignId();
  const { t } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const currentUser = getCurrentUser();
  const isMaster = !!(activeCampaign && currentUser && activeCampaign.owner?.id === currentUser.id);

  const [quests, setQuests] = useState<QuestPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuestStatus | 'all'>('all');
  const [statusTab, setStatusTab] = useState<QuestStatus | 'all'>('all');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingQuest, setEditingQuest] = useState<QuestPayload | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [questToDelete, setQuestToDelete] = useState<QuestPayload | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await listQuests(campaignId);
      setQuests(data);
    } catch (error) {
      console.error('Failed to load quests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [campaignId]);

  const handleCreate = () => {
    setEditingQuest(null);
    setOpenDialog(true);
  };

  const handleEdit = (quest: QuestPayload) => {
    setEditingQuest(quest);
    setOpenDialog(true);
  };

  const handleDelete = (quest: QuestPayload) => {
    setQuestToDelete(quest);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!questToDelete) return;
    try {
      await deleteQuest(questToDelete.id);
      await load();
      setSnackbar({
        open: true,
        message: t('quest_deleted', 'Misión eliminada correctamente'),
        severity: 'success',
      });
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || t('delete_failed', 'Error al eliminar'),
        severity: 'error',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setQuestToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setQuestToDelete(null);
  };

  const handleStatusChange = async (questId: string, newStatus: QuestStatus) => {
    try {
      await updateQuest(questId, { status: newStatus });
      await load();
      setSnackbar({
        open: true,
        message: t('status_changed', 'Estado actualizado correctamente'),
        severity: 'success',
      });
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || t('status_change_failed', 'Error al cambiar estado'),
        severity: 'error',
      });
    }
  };

  const handleDialogClose = async (shouldReload?: boolean) => {
    setOpenDialog(false);
    setEditingQuest(null);
    if (shouldReload) {
      await load();
    }
  };

  // Filter quests based on search and status
  const filteredQuests = useMemo(() => {
    let filtered = quests;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.title.toLowerCase().includes(term) ||
          q.description?.toLowerCase().includes(term)
      );
    }

    // Filter by status (tabs)
    if (statusTab !== 'all') {
      filtered = filtered.filter((q) => q.status === statusTab);
    }

    return filtered;
  }, [quests, searchTerm, statusTab]);

  // Group quests by status for organized display
  const questsByStatus = useMemo(() => {
    const groups: Record<QuestStatus, QuestPayload[]> = {
      not_accepted: [],
      accepted: [],
      completed: [],
    };
    filteredQuests.forEach((q) => {
      groups[q.status].push(q);
    });
    return groups;
  }, [filteredQuests]);

  // Check if quest prerequisites are met
  const canAcceptQuest = (quest: QuestPayload): boolean => {
    if (!quest.prerequisiteQuestId) return true;
    const prereq = quests.find((q) => q.id === quest.prerequisiteQuestId);
    return prereq?.status === 'completed';
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">{t('quests', 'Misiones')}</Typography>
        {isMaster && (
          <Button startIcon={<AddIcon />} variant="contained" onClick={handleCreate}>
            {t('new_quest', 'Nueva Misión')}
          </Button>
        )}
      </Stack>

      {/* Search and Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          placeholder={t('search_quests', 'Buscar misiones...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ flexGrow: 1 }}
        />
      </Stack>

      {/* Status Tabs */}
      <Tabs value={statusTab} onChange={(_, val) => setStatusTab(val)} sx={{ mb: 2 }}>
        <Tab label={t('all', 'Todas')} value="all" />
        {isMaster && <Tab label={t('not_accepted', 'Sin Aceptar')} value="not_accepted" />}
        <Tab label={t('accepted', 'Aceptadas')} value="accepted" />
        <Tab label={t('completed', 'Completadas')} value="completed" />
      </Tabs>

      {/* Quest List */}
      {loading ? (
        <Typography color="text.secondary">{t('loading', 'Cargando...')}</Typography>
      ) : filteredQuests.length === 0 ? (
        <Typography color="text.secondary">
          {t('no_quests_found', 'No se encontraron misiones')}
        </Typography>
      ) : (
        <Stack spacing={3}>
          {statusTab === 'all' ? (
            // Show grouped by status when viewing all
            <>
              {isMaster && questsByStatus.not_accepted.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {t('not_accepted', 'Sin Aceptar')}
                  </Typography>
                  <Stack spacing={2}>
                    {questsByStatus.not_accepted.map((quest) => (
                      <QuestCard
                        key={quest.id}
                        quest={quest}
                        isMaster={isMaster}
                        canAccept={canAcceptQuest(quest)}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
              {questsByStatus.accepted.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {t('accepted', 'Aceptadas')}
                  </Typography>
                  <Stack spacing={2}>
                    {questsByStatus.accepted.map((quest) => (
                      <QuestCard
                        key={quest.id}
                        quest={quest}
                        isMaster={isMaster}
                        canAccept={canAcceptQuest(quest)}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
              {questsByStatus.completed.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {t('completed', 'Completadas')}
                  </Typography>
                  <Stack spacing={2}>
                    {questsByStatus.completed.map((quest) => (
                      <QuestCard
                        key={quest.id}
                        quest={quest}
                        isMaster={isMaster}
                        canAccept={canAcceptQuest(quest)}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </>
          ) : (
            // Show flat list when a specific tab is selected
            <Stack spacing={2}>
              {filteredQuests.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  isMaster={isMaster}
                  canAccept={canAcceptQuest(quest)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {/* Create/Edit Dialog */}
      {openDialog && (
        <QuestFormDialog
          open={openDialog}
          quest={editingQuest}
          campaignId={campaignId}
          availableQuests={quests}
          onClose={handleDialogClose}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          {t('confirm_delete_quest', '¿Eliminar esta misión?')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {questToDelete && (
              <>
                {t('confirm_delete_quest_message', '¿Estás seguro de que deseas eliminar la misión')} "{questToDelete.title}"?
                <br />
                {t('action_cannot_be_undone', 'Esta acción no se puede deshacer.')}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            {t('cancel', 'Cancelar')}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" autoFocus>
            {t('delete', 'Eliminar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
