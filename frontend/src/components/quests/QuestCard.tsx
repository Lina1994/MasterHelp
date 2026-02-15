import React from 'react';
import { useTranslation } from 'react-i18next';
import { QuestPayload, QuestStatus } from '../../api/quests';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  IconButton,
  Button,
  Stack,
  Box,
  Tooltip,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LockIcon from '@mui/icons-material/Lock';

interface QuestCardProps {
  quest: QuestPayload;
  isMaster: boolean;
  canAccept: boolean;
  onEdit: (quest: QuestPayload) => void;
  onDelete: (quest: QuestPayload) => void;
  onStatusChange: (questId: string, newStatus: QuestStatus) => void;
}

export const QuestCard: React.FC<QuestCardProps> = ({
  quest,
  isMaster,
  canAccept,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const { t } = useTranslation();

  const getStatusColor = (status: QuestStatus): 'default' | 'primary' | 'success' => {
    switch (status) {
      case 'not_accepted':
        return 'default';
      case 'accepted':
        return 'primary';
      case 'completed':
        return 'success';
    }
  };

  const getStatusLabel = (status: QuestStatus): string => {
    switch (status) {
      case 'not_accepted':
        return t('not_accepted', 'Sin Aceptar');
      case 'accepted':
        return t('accepted', 'Aceptada');
      case 'completed':
        return t('completed', 'Completada');
    }
  };

  const handleAccept = () => {
    if (!canAccept) {
      // Button should be disabled, but as a safety check, don't proceed
      return;
    }
    onStatusChange(quest.id, 'accepted');
  };

  const handleComplete = () => {
    onStatusChange(quest.id, 'completed');
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" gutterBottom>
              {quest.title}
            </Typography>
            {quest.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {quest.description}
              </Typography>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label={getStatusLabel(quest.status)}
                color={getStatusColor(quest.status)}
                size="small"
              />
              {quest.prerequisiteQuest && (
                <Chip
                  label={`Requiere: ${quest.prerequisiteQuest.title}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
            {quest.prerequisiteQuestId && !canAccept && quest.status === 'not_accepted' && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                <Typography variant="caption">
                  {t(
                    'prerequisite_not_met',
                    'Esta misión requiere completar otra primero'
                  )}
                </Typography>
              </Alert>
            )}
            {quest.statusChangedAt && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {quest.status === 'accepted' &&
                  t('accepted_on', 'Aceptada el') +
                    ' ' +
                    new Date(quest.statusChangedAt).toLocaleString()}
                {quest.status === 'completed' &&
                  t('completed_on', 'Completada el') +
                    ' ' +
                    new Date(quest.statusChangedAt).toLocaleString()}
              </Typography>
            )}
          </Box>
          {isMaster && (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title={t('edit', 'Editar')}>
                <IconButton size="small" onClick={() => onEdit(quest)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('delete', 'Eliminar')}>
                <IconButton size="small" color="error" onClick={() => onDelete(quest)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>
      </CardContent>
      {!isMaster && (
        <CardActions>
          {quest.status === 'not_accepted' && (
            <Button
              size="small"
              startIcon={canAccept ? <PlayArrowIcon /> : <LockIcon />}
              onClick={handleAccept}
              disabled={!canAccept}
              variant="contained"
            >
              {t('accept_quest', 'Aceptar Misión')}
            </Button>
          )}
          {quest.status === 'accepted' && (
            <Button
              size="small"
              startIcon={<CheckCircleIcon />}
              onClick={handleComplete}
              variant="contained"
              color="success"
            >
              {t('complete_quest', 'Completar Misión')}
            </Button>
          )}
        </CardActions>
      )}
    </Card>
  );
};
