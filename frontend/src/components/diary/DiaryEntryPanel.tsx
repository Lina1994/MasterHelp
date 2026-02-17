import { Alert, Box, Button, Card, CardContent, Divider, IconButton, Stack, Switch, TextField, Typography } from '@mui/material';
import type { DiaryEntryResponse } from '../../api/diary/diaryApi';
import { RichTextEditor } from '../common/RichTextEditor';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import EditIcon from '@mui/icons-material/Edit';
import { useState } from 'react';

export type DiaryEntryItemDraft = {
  id?: string;
  clientId: string;
  title: string | null;
  html: string;
  isPublic: boolean;
};

export interface DiaryEntryPanelProps {
  isMaster: boolean;
  dayLabel: string;
  entry: DiaryEntryResponse | null;
  items: DiaryEntryItemDraft[];
  onChangeItems: (items: DiaryEntryItemDraft[]) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  error: string | null;
}

/**
 * Diary entry viewer/editor.
 */
export function DiaryEntryPanel({
  isMaster,
  dayLabel,
  entry,
  items,
  onChangeItems,
  onSave,
  isSaving,
  error,
}: DiaryEntryPanelProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const addItem = () => {
    const clientId = `new-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newItems = [
      // Add new item at the beginning (top) since newest items are shown first
      {
        clientId,
        title: null,
        html: '',
        isPublic: false, // default private
      },
      ...items,
    ];
    onChangeItems(newItems);
    // Set the new item as editing
    setEditingItemId(clientId);
  };

  const updateItem = (clientId: string, patch: Partial<DiaryEntryItemDraft>) => {
    onChangeItems(items.map((it) => (it.clientId === clientId ? { ...it, ...patch } : it)));
  };

  const deleteItem = (clientId: string) => {
    onChangeItems(items.filter((it) => it.clientId !== clientId));
  };

  const moveItem = (clientId: string, dir: -1 | 1) => {
    const idx = items.findIndex((it) => it.clientId === clientId);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= items.length) return;
    const copy = items.slice();
    const tmp = copy[idx];
    copy[idx] = copy[nextIdx];
    copy[nextIdx] = tmp;
    onChangeItems(copy);
  };

  const publicItems = (entry?.items || []).filter((it) => it.isPublic);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">{dayLabel}</Typography>

          {error ? <Alert severity="error">{error}</Alert> : null}

          {!isMaster ? (
            <Stack spacing={2}>
              {publicItems.length === 0 ? (
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    minHeight: 120,
                  }}
                  dangerouslySetInnerHTML={{ __html: '<p><em>Sin entradas públicas.</em></p>' }}
                />
              ) : (
                publicItems.map((it) => (
                  <Box key={it.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                    {it.title ? <Typography variant="subtitle2" sx={{ mb: 1 }}>{it.title}</Typography> : null}
                    <Box dangerouslySetInnerHTML={{ __html: it.html || '' }} />
                  </Box>
                ))
              )}
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Typography variant="subtitle2">Entradas</Typography>
                <Button variant="outlined" onClick={addItem}>+ Añadir entrada</Button>
              </Stack>

              {items.length === 0 ? (
                <Alert severity="info">Aún no hay entradas para este día.</Alert>
              ) : null}

              {items.map((it, idx) => {
                const isFirstItem = idx === 0;
                const isEditing = editingItemId === it.clientId || isFirstItem;

                if (!isEditing) {
                  // Compact view
                  return (
                    <Box
                      key={it.clientId}
                      onClick={() => setEditingItemId(it.clientId)}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                        position: 'relative',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                        {it.title ? (
                          <Typography variant="subtitle2" fontWeight="bold">{it.title}</Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary" fontStyle="italic">Sin título</Typography>
                        )}
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          <Typography variant="caption" color={it.isPublic ? 'success.main' : 'text.secondary'}>
                            {it.isPublic ? 'Pública' : 'Privada'}
                          </Typography>
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditingItemId(it.clientId); }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                      <Box
                        sx={{ mt: 1 }}
                        dangerouslySetInnerHTML={{ __html: it.html || '<p><em>Sin contenido</em></p>' }}
                      />
                    </Box>
                  );
                }

                // Full edit view
                return (
                <Box key={it.clientId} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                    <TextField
                      label="Título (opcional)"
                      size="small"
                      value={it.title ?? ''}
                      onChange={(e) => updateItem(it.clientId, { title: e.target.value || null })}
                      sx={{ flex: 1 }}
                    />
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography variant="body2">Pública</Typography>
                      <Switch
                        checked={it.isPublic}
                        onChange={(_, v) => updateItem(it.clientId, { isPublic: v })}
                      />
                      <IconButton size="small" onClick={() => moveItem(it.clientId, -1)} disabled={idx === 0}>
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => moveItem(it.clientId, 1)} disabled={idx === items.length - 1}>
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteItem(it.clientId)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <RichTextEditor
                    value={it.html}
                    onChange={(v) => updateItem(it.clientId, { html: v })}
                    placeholder={it.isPublic ? 'Contenido público (visible para jugadores)' : 'Contenido privado (solo master)'}
                  />
                </Box>
                );
              })}
            </Stack>
          )}

          {isMaster ? (
            <Stack direction="row" justifyContent="flex-end" gap={1}>
              <Button variant="contained" onClick={onSave} disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Guardar'}
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
