import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Divider, IconButton, Stack, Switch, TextField, Typography } from '@mui/material';
import type { DiaryCalendarConfig, DiarySessionResponse } from '../../api/diary/diaryApi';
import { RichTextEditor } from '../common/RichTextEditor';
import ConfirmDialog from '../common/ConfirmDialog';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { formatDayRefCompact } from './diaryUtils';

type SessionItemDraft = {
  id?: string;
  clientId: string;
  title: string | null;
  html: string;
  isPublic: boolean;
};

function mapApiItemToDraft(it: { id: string; title: string | null; html: string | null; isPublic: boolean }): SessionItemDraft {
  return {
    id: it.id,
    clientId: it.id,
    title: it.title ?? null,
    html: it.html || '',
    isPublic: !!it.isPublic,
  };
}

export interface DiarySessionsPanelProps {
  isMaster: boolean;
  calendarConfig?: DiaryCalendarConfig | null;
  sessions: DiarySessionResponse[];
  activeSession: DiarySessionResponse | null;
  onStartSession: () => Promise<void>;
  onEndSession: () => Promise<void>;
  onReload: () => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onUpdateSession: (
    sessionId: string,
    patch: {
      title?: string | null;
      isPublic?: boolean;
      items?: Array<{ id?: string; title?: string | null; html?: string | null; isPublic?: boolean; order?: number }>;
    },
  ) => Promise<DiarySessionResponse | void>;
  error: string | null;
  highlightStartButton?: boolean;
}

/**
 * Sessions list and editor.
 */
export function DiarySessionsPanel({
  isMaster,
  calendarConfig,
  sessions,
  activeSession,
  onStartSession,
  onEndSession,
  onReload,
  onDeleteSession,
  onUpdateSession,
  error,
  highlightStartButton = false,
}: DiarySessionsPanelProps) {
  const [draftBySessionId, setDraftBySessionId] = useState<Record<string, SessionItemDraft[]>>({});
  const [dirtyBySessionId, setDirtyBySessionId] = useState<Record<string, boolean>>({});
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiarySessionResponse | null>(null);

  // Initialize drafts from server sessions (do not clobber dirty drafts).
  useEffect(() => {
    setDraftBySessionId((prev) => {
      const next = { ...prev };
      for (const s of sessions) {
        if (dirtyBySessionId[s.id]) continue;
        next[s.id] = (s.items || []).map(mapApiItemToDraft);
      }
      return next;
    });

    // Best-effort cleanup for removed sessions.
    setDirtyBySessionId((prev) => {
      const keep = new Set(sessions.map((s) => s.id));
      const next: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (keep.has(k)) next[k] = v;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingSessionId(deleteTarget.id);
    try {
      await onDeleteSession(deleteTarget.id);
    } finally {
      setDeletingSessionId(null);
      setDeleteTarget(null);
    }
  };

  const setDirty = (sessionId: string, value: boolean) => {
    setDirtyBySessionId((prev) => ({ ...prev, [sessionId]: value }));
  };

  const updateDraft = (sessionId: string, updater: (items: SessionItemDraft[]) => SessionItemDraft[]) => {
    setDraftBySessionId((prev) => {
      const current = prev[sessionId] || [];
      const nextItems = updater(current);
      return { ...prev, [sessionId]: nextItems };
    });
    setDirty(sessionId, true);
  };

  const addItem = (sessionId: string) => {
    updateDraft(sessionId, (items) => {
      const clientId = `new-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return [
        ...items,
        {
          clientId,
          title: null,
          html: '',
          isPublic: false,
        },
      ];
    });
  };

  const moveItem = (sessionId: string, clientId: string, dir: -1 | 1) => {
    updateDraft(sessionId, (items) => {
      const idx = items.findIndex((it) => it.clientId === clientId);
      if (idx < 0) return items;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= items.length) return items;
      const copy = items.slice();
      const tmp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = tmp;
      return copy;
    });
  };

  const deleteItem = (sessionId: string, clientId: string) => {
    updateDraft(sessionId, (items) => items.filter((it) => it.clientId !== clientId));
  };

  const saveItems = async (sessionId: string) => {
    const items = draftBySessionId[sessionId] || [];
    const updated = await onUpdateSession(sessionId, {
      items: items.map((it, idx) => ({
        ...(it.id ? { id: it.id } : {}),
        title: it.title,
        html: it.html,
        isPublic: it.isPublic,
        order: idx,
      })),
    });

    if (updated && (updated as any).items) {
      const u = updated as DiarySessionResponse;
      setDraftBySessionId((prev) => ({ ...prev, [sessionId]: (u.items || []).map(mapApiItemToDraft) }));
    }
    setDirty(sessionId, false);
  };

  const formatDayRefs = useMemo(() => {
    const map: Record<string, string> = {};
    sessions.forEach((s) => {
      map[s.id] =
        s.days
          .map((d) => {
            if (calendarConfig) return formatDayRefCompact(calendarConfig, d);
            return `A${d.year}-M${d.monthIndex + 1}-D${d.dayIndex}`;
          })
          .join(', ') || '—';
    });
    return map;
  }, [sessions, calendarConfig]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Typography variant="h5">Sesiones</Typography>
        <Stack direction="row" gap={1}>
          {isMaster ? (
            activeSession ? (
              <Button variant="contained" color="error" onClick={onEndSession}>Finalizar sesión</Button>
            ) : (
              <Button
                variant="contained"
                onClick={onStartSession}
                sx={{
                  animation: highlightStartButton ? 'pulse 1s ease-in-out 2' : 'none',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(1)', boxShadow: 3 },
                    '50%': { transform: 'scale(1.05)', boxShadow: 6 },
                    '100%': { transform: 'scale(1)', boxShadow: 3 },
                  },
                }}
              >
                Iniciar sesión
              </Button>
            )
          ) : null}
          <Button variant="outlined" onClick={onReload}>Recargar</Button>
        </Stack>
      </Stack>

      {activeSession ? (
        <Alert severity="info">
          Sesión activa: {activeSession.title || 'Sin título'} ({activeSession.days.length} días registrados)
        </Alert>
      ) : (
        <Alert severity="warning">No hay sesión activa.</Alert>
      )}

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={2}>
        {sessions.map((s) => (
          <Card key={s.id} variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                  <Stack spacing={0.5} sx={{ flex: 1 }}>
                    <Typography variant="subtitle1">
                      {s.title || 'Sesión'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(s.startedAt).toLocaleString()} {s.endedAt ? `→ ${new Date(s.endedAt).toLocaleString()}` : '(activa)'}
                      {' · '}{s.days.length} días
                      {' · '}{s.isPublic ? 'Pública' : 'Privada'}
                    </Typography>
                  </Stack>

                  {isMaster ? (
                    <Stack direction="row" alignItems="center" gap={1}>
                      {s.endedAt ? (
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => setDeleteTarget(s)}
                          disabled={deletingSessionId === s.id}
                        >
                          {deletingSessionId === s.id ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                      ) : null}

                      <Typography variant="caption">Pública</Typography>
                      <Switch
                        checked={s.isPublic}
                        onChange={(_, v) => onUpdateSession(s.id, { isPublic: v })}
                      />
                    </Stack>
                  ) : null}
                </Stack>

                {isMaster ? (
                  <TextField
                    size="small"
                    label="Título"
                    defaultValue={s.title || ''}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      onUpdateSession(s.id, { title: next || null });
                    }}
                  />
                ) : null}

                {!isMaster ? (
                  <Stack spacing={2}>
                    {(!s.items || s.items.length === 0) ? (
                      <Box
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          p: 2,
                          minHeight: 80,
                        }}
                        dangerouslySetInnerHTML={{ __html: '<p><em>Sin entradas públicas.</em></p>' }}
                      />
                    ) : (
                      (s.items || []).map((it) => (
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
                      <Stack direction="row" gap={1}>
                        <Button variant="outlined" onClick={() => addItem(s.id)}>+ Añadir entrada</Button>
                        <Button variant="contained" onClick={() => saveItems(s.id)} disabled={!dirtyBySessionId[s.id]}>
                          Guardar
                        </Button>
                      </Stack>
                    </Stack>

                    {(draftBySessionId[s.id] || []).length === 0 ? (
                      <Alert severity="info">Aún no hay entradas para esta sesión.</Alert>
                    ) : null}

                    {(draftBySessionId[s.id] || []).map((it, idx) => (
                      <Box key={it.clientId} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                          <TextField
                            label="Título (opcional)"
                            size="small"
                            value={it.title ?? ''}
                            onChange={(e) => {
                              const v = e.target.value || '';
                              updateDraft(s.id, (items) => items.map((x) => x.clientId === it.clientId ? { ...x, title: v.trim() ? v : null } : x));
                            }}
                            sx={{ flex: 1 }}
                          />
                          <Stack direction="row" alignItems="center" gap={1}>
                            <Typography variant="body2">Pública</Typography>
                            <Switch
                              checked={it.isPublic}
                              onChange={(_, v) => updateDraft(s.id, (items) => items.map((x) => x.clientId === it.clientId ? { ...x, isPublic: v } : x))}
                            />
                            <IconButton size="small" onClick={() => moveItem(s.id, it.clientId, -1)} disabled={idx === 0}>
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => moveItem(s.id, it.clientId, 1)} disabled={idx === (draftBySessionId[s.id] || []).length - 1}>
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => deleteItem(s.id, it.clientId)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>

                        <Divider sx={{ my: 2 }} />

                        <RichTextEditor
                          value={it.html}
                          onChange={(v) => updateDraft(s.id, (items) => items.map((x) => x.clientId === it.clientId ? { ...x, html: v } : x))}
                          placeholder={it.isPublic ? 'Contenido público (visible para jugadores)' : 'Contenido privado (solo master)'}
                          minHeight={120}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}

                <Divider />
                <Typography variant="caption" color="text.secondary">
                  Días registrados: {formatDayRefs[s.id]}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}

        {!sessions.length ? (
          <Alert severity="info">Aún no hay sesiones registradas.</Alert>
        ) : null}
      </Stack>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar sesión"
        message={deleteTarget ? `¿Eliminar “${deleteTarget.title || 'Sesión'}”? Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        confirmColor="error"
        confirmDisabled={!!deletingSessionId}
        onClose={() => (deletingSessionId ? null : setDeleteTarget(null))}
        onConfirm={handleConfirmDelete}
      />
    </Stack>
  );
}
