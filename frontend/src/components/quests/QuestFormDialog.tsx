import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from '@mui/material';
import {
  createQuest,
  updateQuest,
  QuestPayload,
  QuestStatus,
  CreateQuestPayload,
  UpdateQuestPayload,
} from '../../api/quests';

interface QuestFormDialogProps {
  open: boolean;
  quest: QuestPayload | null; // null = creating new quest
  campaignId: string;
  availableQuests: QuestPayload[]; // For prerequisite selection
  onClose: (shouldReload?: boolean) => void;
}

export const QuestFormDialog: React.FC<QuestFormDialogProps> = ({
  open,
  quest,
  campaignId,
  availableQuests,
  onClose,
}) => {
  const { t } = useTranslation();
  const isEditing = !!quest;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<QuestStatus>('not_accepted');
  const [prerequisiteQuestId, setPrerequisiteQuestId] = useState<string>('');
  const [order, setOrder] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (quest) {
      setTitle(quest.title);
      setDescription(quest.description || '');
      setStatus(quest.status);
      setPrerequisiteQuestId(quest.prerequisiteQuestId || '');
      setOrder(quest.order);
    } else {
      // Reset for new quest
      setTitle('');
      setDescription('');
      setStatus('not_accepted');
      setPrerequisiteQuestId('');
      setOrder(0);
    }
    setError('');
  }, [quest, open]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError(t('title_required', 'El título es requerido'));
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        const payload: UpdateQuestPayload = {
          title: title.trim(),
          description: description.trim() || null,
          status,
          prerequisiteQuestId: prerequisiteQuestId || null,
          order,
        };
        await updateQuest(quest.id, payload);
      } else {
        const payload: CreateQuestPayload = {
          campaignId,
          title: title.trim(),
          description: description.trim() || null,
          status,
          prerequisiteQuestId: prerequisiteQuestId || null,
          order,
        };
        await createQuest(payload);
      }
      onClose(true); // Reload list
    } catch (err: any) {
      console.error('Failed to save quest:', err);
      setError(err?.response?.data?.message || t('save_failed', 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  // Filter out current quest from prerequisite options (can't depend on itself)
  const eligiblePrerequisites = availableQuests.filter((q) => q.id !== quest?.id);

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEditing ? t('edit_quest', 'Editar Misión') : t('new_quest', 'Nueva Misión')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('title', 'Título')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <TextField
            label={t('description', 'Descripción')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={4}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>{t('status', 'Estado')}</InputLabel>
            <Select
              value={status}
              label={t('status', 'Estado')}
              onChange={(e) => setStatus(e.target.value as QuestStatus)}
            >
              <MenuItem value="not_accepted">{t('not_accepted', 'Sin Aceptar')}</MenuItem>
              <MenuItem value="accepted">{t('accepted', 'Aceptada')}</MenuItem>
              <MenuItem value="completed">{t('completed', 'Completada')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>{t('prerequisite', 'Prerequisito (opcional)')}</InputLabel>
            <Select
              value={prerequisiteQuestId}
              label={t('prerequisite', 'Prerequisito (opcional)')}
              onChange={(e) => setPrerequisiteQuestId(e.target.value)}
            >
              <MenuItem value="">
                <em>{t('none', 'Ninguno')}</em>
              </MenuItem>
              {eligiblePrerequisites.map((q) => (
                <MenuItem key={q.id} value={q.id}>
                  {q.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={t('order', 'Orden')}
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            fullWidth
            helperText={t('order_help', 'Orden de visualización (menor = primero)')}
          />
          {error && (
            <div style={{ color: 'red', fontSize: '0.875rem' }}>{error}</div>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} disabled={saving}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? t('saving', 'Guardando...') : t('save', 'Guardar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
