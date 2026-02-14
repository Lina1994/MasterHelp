import { useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Divider, Stack, Switch, Tab, Tabs, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useSearchParams } from 'react-router-dom';
import { getCurrentUser } from '../utils/getCurrentUser';
import {
  getActiveDiarySession,
  getDiaryCalendar,
  getDiaryEntry,
  listDiarySessions,
  startDiarySession,
  endDiarySession,
  deleteDiarySession,
  updateDiaryCalendar,
  upsertDiaryEntry,
  updateDiarySession,
  visitDiaryDay,
  type DiaryCalendarConfig,
  type DiaryDayRef,
  type DiaryEntryResponse,
  type DiaryEntryItemResponse,
  type DiarySessionResponse,
} from '../api/diary/diaryApi';
import { DiaryCalendarSettings } from '../components/diary/DiaryCalendarSettings';
import { DiaryCalendarView } from '../components/diary/DiaryCalendarView';
import { DiaryEntryPanel } from '../components/diary/DiaryEntryPanel';
import { DiarySessionsPanel } from '../components/diary/DiarySessionsPanel';
import { formatDayLabel } from '../components/diary/diaryUtils';
import { useDiarySidebar } from '../components/diary/DiarySidebarContext';

import type { DiaryEntryItemDraft } from '../components/diary/DiaryEntryPanel';

function mapApiItemToDraft(it: DiaryEntryItemResponse): DiaryEntryItemDraft {
  return {
    id: it.id,
    clientId: it.id,
    title: it.title ?? null,
    html: it.html || '',
    isPublic: !!it.isPublic,
  };
}

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some((p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master');
}

/**
 * Diario (campaign-scoped).
 */
export default function DiaryPage() {
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);

  const {
    selectedDay: contextSelectedDay,
    setSelectedDay,
    showSelectedDayInSidebar,
    setShowSelectedDayInSidebar,
    showSelectedDayInSkyline,
    setShowSelectedDayInSkyline,
    showNoActiveSessionWarning,
    setShowNoActiveSessionWarning,
    showDayNavigation,
    setShowDayNavigation,
    setActiveSessionId,
  } = useDiarySidebar();

  const [tab, setTab] = useState<'calendar' | 'sessions' | 'settings'>('calendar');
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightStartButton, setHighlightStartButton] = useState(false);
  const [calendarSettingsExpanded, setCalendarSettingsExpanded] = useState(false);

  const [calendar, setCalendar] = useState<DiaryCalendarConfig | null>(null);
  const [calendarDraft, setCalendarDraft] = useState<DiaryCalendarConfig | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [selectedDay, setSelectedDayState] = useState<DiaryDayRef | null>(null);

  const [entry, setEntry] = useState<DiaryEntryResponse | null>(null);
  const [itemsDraft, setItemsDraft] = useState<DiaryEntryItemDraft[]>([]);
  const [savingEntry, setSavingEntry] = useState(false);

  const [sessions, setSessions] = useState<DiarySessionResponse[]>([]);
  const [activeSession, setActiveSession] = useState<DiarySessionResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayLabel = useMemo(() => {
    if (!calendar || !selectedDay) return '';
    return formatDayLabel(calendar, selectedDay);
  }, [calendar, selectedDay]);

  const reloadAll = async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const cal = await getDiaryCalendar(campaignId);
      setCalendar(cal.config);
      setCalendarDraft(cal.config);

      const sessionsList = await listDiarySessions(campaignId);
      setSessions(sessionsList);

      const active = await getActiveDiarySession(campaignId);
      setActiveSession(active);

      // Si hay un día guardado en el contexto para esta campaña, usarlo
      if (contextSelectedDay?.campaignId === campaignId && contextSelectedDay.day) {
        setSelectedMonthIndex(contextSelectedDay.day.monthIndex);
        setSelectedDayState(contextSelectedDay.day);
      } else {
        // Si no, establecer valores por defecto
        setSelectedMonthIndex(0);
        const defaultDay: DiaryDayRef = { year: cal.config.currentYear, monthIndex: 0, dayIndex: 1 };
        setSelectedDayState(defaultDay);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error cargando el diario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!campaignId) return;
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Sincronizar el ID de la sesión activa con el contexto
  useEffect(() => {
    setActiveSessionId(activeSession?.id ?? null);
  }, [activeSession, setActiveSessionId]);

  // Detectar parámetros de URL para abrir pestaña de sesiones y animar
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const highlightParam = searchParams.get('highlight');
    
    if (tabParam === 'sessions') {
      setTab('sessions');
      
      if (highlightParam === 'start') {
        // Animar el botón después de un pequeño delay
        setTimeout(() => {
          setHighlightStartButton(true);
          setTimeout(() => setHighlightStartButton(false), 2000);
        }, 300);
      }
      
      // Limpiar parámetros de URL
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const loadEntry = async (day: DiaryDayRef) => {
    if (!campaignId) return;
    setError(null);
    try {
      const e = await getDiaryEntry(campaignId, day);
      setEntry(e);
      setItemsDraft((e.items || []).map(mapApiItemToDraft));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error cargando la entrada del diario');
    }
  };

  useEffect(() => {
    if (!calendar || !selectedDay) return;
    void loadEntry(selectedDay);
    setSelectedDay({
      label: formatDayLabel(calendar, selectedDay),
      campaignId: campaignId || '',
      day: selectedDay,
    });
    // If a session is active, register the day (master only).
    if (campaignId && activeSession && isMaster) {
      void visitDiaryDay(campaignId, activeSession.id, selectedDay).then(setActiveSession).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, calendar, campaignId, isMaster]);

  const handleSaveEntry = async () => {
    if (!campaignId || !selectedDay || !isMaster) return;
    setSavingEntry(true);
    setError(null);
    try {
      const saved = await upsertDiaryEntry(campaignId, {
        year: selectedDay.year,
        monthIndex: selectedDay.monthIndex,
        dayIndex: selectedDay.dayIndex,
        items: itemsDraft.map((it, idx) => ({
          ...(it.id ? { id: it.id } : {}),
          title: it.title,
          html: it.html,
          isPublic: it.isPublic,
          order: idx,
        })),
      });
      setEntry(saved);
      setItemsDraft((saved.items || []).map(mapApiItemToDraft));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error guardando la entrada');
    } finally {
      setSavingEntry(false);
    }
  };

  const handleSaveCalendar = async () => {
    if (!campaignId || !calendarDraft || !isMaster) return;
    setError(null);
    setLoading(true);
    try {
      const saved = await updateDiaryCalendar(campaignId, calendarDraft);
      setCalendar(saved.config);
      setCalendarDraft(saved.config);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error guardando el calendario');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!campaignId || !isMaster) return;
    setError(null);
    try {
      const started = await startDiarySession(campaignId, { title: null, isPublic: false });
      setActiveSession(started);
      const sessionsList = await listDiarySessions(campaignId);
      setSessions(sessionsList);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error iniciando sesión');
    }
  };

  const handleEndSession = async () => {
    if (!campaignId || !isMaster || !activeSession) return;
    setError(null);
    try {
      const ended = await endDiarySession(campaignId, activeSession.id);
      setActiveSession(null);
      setSessions((prev) => prev.map((s) => (s.id === ended.id ? ended : s)));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error finalizando sesión');
    }
  };

  const handleUpdateSession = async (
    sessionId: string,
    patch: {
      title?: string | null;
      isPublic?: boolean;
      items?: Array<{ id?: string; title?: string | null; html?: string | null; isPublic?: boolean; order?: number }>;
    },
  ) => {
    if (!campaignId || !isMaster) return;
    try {
      const updated = await updateDiarySession(campaignId, sessionId, patch);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (activeSession?.id === updated.id) setActiveSession(updated);
      return updated;
    } catch {}
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!campaignId || !isMaster) return;
    setError(null);
    try {
      await deleteDiarySession(campaignId, sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession?.id === sessionId) setActiveSession(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error eliminando la sesión');
      throw e;
    }
  };

  if (!campaignId) {
    return <Alert severity="info">Selecciona una campaña para usar el Diario.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h4">Diario</Typography>
        <Button variant="outlined" onClick={reloadAll} disabled={loading}>
          {loading ? 'Cargando…' : 'Recargar'}
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab value="calendar" label="Calendario" />
        <Tab value="sessions" label="Sesiones" />
        <Tab value="settings" label="Ajustes" />
      </Tabs>
      <Divider />

      {tab === 'calendar' ? (
        <Stack spacing={2} direction={{ xs: 'column', md: 'row' }}>
          <Box sx={{ flex: 2, minWidth: 360 }}>
            {calendar && selectedDay ? (
              <DiaryEntryPanel
                isMaster={isMaster}
                dayLabel={dayLabel}
                entry={entry}
                items={itemsDraft}
                onChangeItems={setItemsDraft}
                onSave={handleSaveEntry}
                isSaving={savingEntry}
                error={error}
              />
            ) : (
              <Alert severity="info">Selecciona un día…</Alert>
            )}
          </Box>

          <Box sx={{ flex: 1, minWidth: 280, maxWidth: { md: 400 } }}>
            {calendar ? (
              <DiaryCalendarView
                config={calendar}
                selectedDay={selectedDay}
                selectedMonthIndex={selectedMonthIndex}
                onMonthChange={(idx) => setSelectedMonthIndex(idx)}
                onSelectDay={(day) => {
                  setSelectedDayState(day);
                  if (calendar) {
                    setSelectedMonthIndex(day.monthIndex);
                  }
                }}
              />
            ) : (
              <Alert severity="info">Cargando calendario…</Alert>
            )}
          </Box>
        </Stack>
      ) : null}

      {tab === 'sessions' ? (
        <DiarySessionsPanel
          isMaster={isMaster}
          calendarConfig={calendar}
          sessions={sessions}
          activeSession={activeSession}
          onStartSession={handleStartSession}
          onEndSession={handleEndSession}
          onReload={async () => {
            if (!campaignId) return;
            const sessionsList = await listDiarySessions(campaignId);
            setSessions(sessionsList);
            const active = await getActiveDiarySession(campaignId);
            setActiveSession(active);
          }}
          onDeleteSession={handleDeleteSession}
          onUpdateSession={handleUpdateSession}
          error={error}
          highlightStartButton={highlightStartButton}
        />
      ) : null}

      {tab === 'settings' && isMaster ? (
        <Stack spacing={2}>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6">Preferencias</Typography>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                  <Typography variant="body2">Mostrar el día seleccionado en el sidebar</Typography>
                  <Switch
                    checked={showSelectedDayInSidebar}
                    onChange={(_, v) => setShowSelectedDayInSidebar(v)}
                  />
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                  <Typography variant="body2">Mostrar el día seleccionado en la ventana Skyline</Typography>
                  <Switch
                    checked={showSelectedDayInSkyline}
                    onChange={(_, v) => setShowSelectedDayInSkyline(v)}
                  />
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                  <Typography variant="body2">Avisar en el sidebar si no hay sesión activa</Typography>
                  <Switch
                    checked={showNoActiveSessionWarning}
                    onChange={(_, v) => setShowNoActiveSessionWarning(v)}
                  />
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                  <Typography variant="body2">Mostrar controles de navegación de día en el sidebar</Typography>
                  <Switch
                    checked={showDayNavigation}
                    onChange={(_, v) => setShowDayNavigation(v)}
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {calendarDraft ? (
            <Accordion 
              expanded={calendarSettingsExpanded} 
              onChange={(_, isExpanded) => setCalendarSettingsExpanded(isExpanded)}
              variant="outlined"
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Configuración del calendario</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <DiaryCalendarSettings
                  config={calendarDraft}
                  onChange={setCalendarDraft}
                  onSave={handleSaveCalendar}
                  isSaving={loading}
                />
              </AccordionDetails>
            </Accordion>
          ) : (
            <Alert severity="info">Cargando…</Alert>
          )}
        </Stack>
      ) : null}

      {tab === 'settings' && !isMaster ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">Preferencias</Typography>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Typography variant="body2">Mostrar el día seleccionado en el sidebar</Typography>
                <Switch
                  checked={showSelectedDayInSidebar}
                  onChange={(_, v) => setShowSelectedDayInSidebar(v)}
                />
              </Stack>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Typography variant="body2">Mostrar el día seleccionado en la ventana Skyline</Typography>
                <Switch
                  checked={showSelectedDayInSkyline}
                  onChange={(_, v) => setShowSelectedDayInSkyline(v)}
                />
              </Stack>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Typography variant="body2">Avisar en el sidebar si no hay sesión activa</Typography>
                <Switch
                  checked={showNoActiveSessionWarning}
                  onChange={(_, v) => setShowNoActiveSessionWarning(v)}
                />
              </Stack>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Typography variant="body2">Mostrar controles de navegación de día en el sidebar</Typography>
                <Switch
                  checked={showDayNavigation}
                  onChange={(_, v) => setShowDayNavigation(v)}
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
