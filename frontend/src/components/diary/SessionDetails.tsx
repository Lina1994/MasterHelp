import React, { useCallback, useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Avatar, Box, CircularProgress, Divider, Stack, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ImageIcon from '@mui/icons-material/Image';
import type { DiaryCalendarConfig, DiaryDayRef, DiarySessionResponse } from '../../api/diary/diaryApi';
import { getDiaryEntry } from '../../api/diary/diaryApi';
import { listCombatLogs, type CombatLog } from '../../api/campaigns/combatLog';
import { getSongPlayHistory, type SongPlayHistoryItem } from '../../api/soundtrack';
import { listCharacters, type CharacterPayload } from '../../api/characters';
import { listMaps, getMapImageUrlSized, type MapItemDto } from '../../api/maps';
import AuthImage from '../common/AuthImage';
import WorldpediaEntityViewer from '../Worldpedia/WorldpediaEntityViewer';
import { formatDayRefCompact } from './diaryUtils';
import CombatLogList from '../Combat/CombatLogList';

interface SessionDetailsProps {
  campaignId: string;
  session: DiarySessionResponse;
  calendarConfig: DiaryCalendarConfig | null;
  isMaster: boolean;
}

/** A diary entry item belonging to one of the session's days. */
interface SessionEntryItem {
  key: string;
  title: string | null;
  html: string | null;
}

/** Diary entries + combats grouped under a single campaign day. */
interface DayGroup {
  key: string;
  label: string;
  entries: SessionEntryItem[];
  combats: CombatLog[];
}

/** Builds a stable key for a campaign day. */
function dayKey(day: DiaryDayRef): string {
  return `${day.year}-${day.monthIndex}-${day.dayIndex}`;
}

/** Formats a day reference, tolerating a missing calendar config. */
function dayLabel(config: DiaryCalendarConfig | null, day: DiaryDayRef): string {
  if (config) return formatDayRefCompact(config, day);
  return `${day.dayIndex}/${day.monthIndex + 1}/${day.year}`;
}

/** Returns true when an HTML string has no visible content (tags/entities stripped). */
function htmlIsEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<[^>]*>/g, '')      // strip tags
    .replace(/&nbsp;/gi, ' ')     // non-breaking spaces
    .replace(/\s+/g, ' ')         // collapse whitespace
    .trim();
  return text.length === 0;
}

/**
 * Enriched details for a diary session: a single chronological block ordered by
 * campaign day, showing each day's diary entries followed by the combats fought
 * that day, plus the songs played during the session — all derived live from
 * existing data (entries, combat logs, play history).
 */
export const SessionDetails: React.FC<SessionDetailsProps> = ({ campaignId, session, calendarConfig, isMaster }) => {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [songs, setSongs] = useState<SongPlayHistoryItem[]>([]);
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [maps, setMaps] = useState<MapItemDto[]>([]);
  const [viewer, setViewer] = useState<{ open: boolean; type: 'character' | 'map' | null; id: string | null }>({ open: false, type: null, id: null });

  const openViewer = useCallback((type: 'character' | 'map', id: string) => {
    setViewer({ open: true, type, id });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(session.startedAt).getTime();
    const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();

    const days = [...(session.days || [])].sort((a, b) =>
      a.year - b.year || a.monthIndex - b.monthIndex || a.dayIndex - b.dayIndex);

    // ── Diary entries per day (skipping empty entries) ──
    const entriesByDay = new Map<string, SessionEntryItem[]>();
    try {
      const results = await Promise.all(days.map((d) => getDiaryEntry(campaignId, d).catch(() => null)));
      days.forEach((d, i) => {
        const entry = results[i];
        const items: SessionEntryItem[] = [];
        (entry?.items || []).forEach((it) => {
          const hasTitle = !!(it.title && it.title.trim());
          if (!hasTitle && htmlIsEmpty(it.html)) return;
          items.push({ key: `${dayKey(d)}-${it.id}`, title: it.title, html: it.html });
        });
        if (items.length) entriesByDay.set(dayKey(d), items);
      });
    } catch { /* ignore */ }

    // ── Combats fought during the session, grouped by their campaign day ──
    const combatsByDay = new Map<string, CombatLog[]>();
    const dayRefs = new Map<string, DiaryDayRef>();
    days.forEach((d) => dayRefs.set(dayKey(d), d));
    try {
      const allLogs = await listCombatLogs(campaignId);
      allLogs
        .filter((l) => {
          const t = new Date(l.startedAt).getTime();
          return t >= start && t <= end;
        })
        .forEach((l) => {
          const ref: DiaryDayRef = { year: l.year, monthIndex: l.monthIndex, dayIndex: l.dayIndex };
          const k = dayKey(ref);
          if (!combatsByDay.has(k)) combatsByDay.set(k, []);
          combatsByDay.get(k)!.push(l);
          if (!dayRefs.has(k)) dayRefs.set(k, ref);
        });
    } catch { /* ignore */ }

    // ── Merge into a single chronological list ordered by day ──
    const orderedDays = [...dayRefs.values()].sort((a, b) =>
      a.year - b.year || a.monthIndex - b.monthIndex || a.dayIndex - b.dayIndex);
    const groups: DayGroup[] = orderedDays
      .map((d) => {
        const k = dayKey(d);
        return {
          key: k,
          label: dayLabel(calendarConfig, d),
          entries: entriesByDay.get(k) || [],
          combats: combatsByDay.get(k) || [],
        };
      })
      .filter((g) => g.entries.length > 0 || g.combats.length > 0);
    setDayGroups(groups);

    // ── Songs played during the session (by time range) ──
    try {
      const history = await getSongPlayHistory(campaignId, { limit: 500 });
      setSongs(history.filter((h) => {
        const t = new Date(h.playedAt).getTime();
        return t >= start && t <= end;
      }));
    } catch {
      setSongs([]);
    }

    // ── Characters & places that appeared during the session (deduped) ──
    try {
      const [allChars, allMaps] = await Promise.all([
        listCharacters(campaignId).catch(() => [] as CharacterPayload[]),
        listMaps({ campaignId }).catch(() => [] as MapItemDto[]),
      ]);
      const charById = new Map(allChars.map((c) => [c.id as string, c]));
      const mapById = new Map(allMaps.map((m) => [m.id, m]));
      setCharacters((session.characterRefs || []).map((id) => charById.get(id)).filter((c): c is CharacterPayload => !!c));
      setMaps((session.mapRefs || []).map((id) => mapById.get(id)).filter((m): m is MapItemDto => !!m));
    } catch {
      setCharacters([]);
      setMaps([]);
    }

    setLoading(false);
    setLoaded(true);
  }, [campaignId, calendarConfig, session.startedAt, session.endedAt, session.days, session.characterRefs, session.mapRefs]);

  // Load on mount. Reload when the session's days/end change so the data fills
  // in progressively as the session is played.
  useEffect(() => {
    void load();
  }, [load]);

  // Light polling while the session is active so new combats/songs appear.
  useEffect(() => {
    if (session.endedAt) return;
    const id = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(id);
  }, [session.endedAt, load]);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Detalles de la sesión (diario, combates y canciones)
      </Typography>
      {loading && !loaded ? (
        <Stack alignItems="center" sx={{ py: 2 }}><CircularProgress size={22} /></Stack>
      ) : (
        <Stack spacing={2}>
          {/* ── Diary entries + combats, ordered by day ── */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Diario y combates</Typography>
            {dayGroups.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin entradas ni combates en los días de esta sesión.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {dayGroups.map((g) => (
                  <Box key={g.key}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                      {g.label}
                    </Typography>
                    <Stack spacing={0.5}>
                      {/* Diary entries first */}
                      {g.entries.map((e) => (
                        <Accordion key={e.key} variant="outlined" disableGutters>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {e.title || 'Sin título'}
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box dangerouslySetInnerHTML={{ __html: e.html || '<p><em>Sin contenido</em></p>' }} />
                          </AccordionDetails>
                        </Accordion>
                      ))}
                      {/* Then the combats of that day */}
                      {g.combats.length > 0 ? (
                        <CombatLogList
                          logs={g.combats}
                          calendar={calendarConfig}
                          isMaster={isMaster}
                        />
                      ) : null}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          <Divider />

          {/* ── Characters that appeared ── */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Personajes</Typography>
            {characters.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Ningún personaje apareció durante esta sesión.</Typography>
            ) : (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {characters.map((c) => {
                  const initials = (c.name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
                  const hasImg = c.tokenKind === 'image' && !!c.tokenImageUrl;
                  return (
                    <Tooltip key={c.id} title={c.name}>
                      <Box
                        onClick={() => c.id && openViewer('character', c.id)}
                        sx={{
                          width: 56, height: 56, borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                          flexShrink: 0, border: '1px solid', borderColor: 'divider',
                          transition: 'transform 0.12s, box-shadow 0.12s',
                          '&:hover': { transform: 'scale(1.05)', boxShadow: 3 },
                        }}
                      >
                        {hasImg ? (
                          // eslint-disable-next-line jsx-a11y/alt-text
                          <img src={c.tokenImageUrl as string} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Avatar variant="rounded" sx={{ width: '100%', height: '100%', bgcolor: c.tokenColor || '#607d8b', borderRadius: 0 }}>
                            {initials}
                          </Avatar>
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Stack>
            )}
          </Box>

          <Divider />

          {/* ── Places (maps) that appeared ── */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Lugares</Typography>
            {maps.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Ningún lugar apareció durante esta sesión.</Typography>
            ) : (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {maps.map((m) => (
                  <Tooltip key={m.id} title={m.name}>
                    <Box
                      onClick={() => openViewer('map', m.id)}
                      sx={{
                        width: 56, height: 56, borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                        flexShrink: 0, border: '1px solid', borderColor: 'divider',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover',
                        transition: 'transform 0.12s, box-shadow 0.12s',
                        '&:hover': { transform: 'scale(1.05)', boxShadow: 3 },
                      }}
                    >
                      {m.imageAvailable ? (
                        <AuthImage
                          src={getMapImageUrlSized(m.id, 'thumb')}
                          alt={m.name}
                          lazy
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onErrorIcon={<ImageIcon fontSize="small" />}
                        />
                      ) : (
                        <ImageIcon fontSize="small" />
                      )}
                    </Box>
                  </Tooltip>
                ))}
              </Stack>
            )}
          </Box>

          <Divider />

          {/* ── Song history ── */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Canciones de la sesión</Typography>
            {songs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No sonó ninguna canción registrada durante esta sesión.</Typography>
            ) : (
              <Stack spacing={0.25}>
                {songs.map((s) => (
                  <Stack key={s.id} direction="row" spacing={1} alignItems="center">
                    <MusicNoteIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">{s.songName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(s.playedAt).toLocaleString()}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      )}

      {viewer.open && viewer.type && viewer.id ? (
        <WorldpediaEntityViewer
          open={viewer.open}
          entityType={viewer.type}
          entityId={viewer.id}
          campaignId={campaignId}
          onClose={() => setViewer({ open: false, type: null, id: null })}
        />
      ) : null}
    </Box>
  );
};

export default SessionDetails;
