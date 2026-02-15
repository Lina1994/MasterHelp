import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Divider, MenuItem, Popover, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AuthImage from '../common/AuthImage';
import type { MapTokenPayload, TokenSize } from '../../api/maps';
import { listEncounters, updateEncounter, type EncounterParticipant, type EncounterSummary } from '../../api/encounters';
import { getCharacter, updateCharacter, type CharacterPayload } from '../../api/characters';
import { useCombatNotes } from '../../hooks/useCombatNotes';
import { useActiveEncounter } from '../Encounter/ActiveEncounterContext';

type AnchorPosition = { left: number; top: number };

const toIntOrUndef = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
};

const clampMin = (value: number | undefined, min: number): number | undefined => {
  if (typeof value !== 'number') return undefined;
  return value < min ? min : value;
};

/**
 * TokenQuickInfoPopover
 *
 * Small tactical popover shown when clicking a token in the DM map preview.
 * It tries to resolve the token to either:
 * - a Character (via `/characters/:id`), or
 * - an Encounter participant (via current campaign battle state + encounters)
 *
 * Allows editing HP and local (combat-scoped) notes.
 */
export const TokenQuickInfoPopover: React.FC<{
  open: boolean;
  token: MapTokenPayload | null;
  anchorPosition?: AnchorPosition;
  campaignId?: string | null;
  resolveTokenImage: (id: string) => string | undefined;
  onClose: () => void;
  onUpdateToken?: (id: string, patch: Partial<MapTokenPayload>) => void;
}> = ({ open, token, anchorPosition, campaignId, resolveTokenImage, onClose, onUpdateToken }) => {
  const navigate = useNavigate();
  const { activeEncounterId } = useActiveEncounter();

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [encounter, setEncounter] = useState<EncounterSummary | null>(null);
  const [participant, setParticipant] = useState<EncounterParticipant | null>(null);
  const [character, setCharacter] = useState<CharacterPayload | null>(null);

  const participantId = token?.id || null;
  const notes = useCombatNotes(campaignId, activeEncounterId);
  const existingNote = useMemo(() => notes.getNote(participantId), [notes, participantId]);

  const [hpDraft, setHpDraft] = useState<{ currentHp?: string; maxHp?: string; tempHp?: string }>({});
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [savingHp, setSavingHp] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const TOKEN_SIZES: TokenSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
  const TOKEN_SIZE_LABELS: Record<TokenSize, string> = {
    tiny: 'Diminuto',
    small: 'Pequeño',
    medium: 'Mediano',
    large: 'Grande',
    huge: 'Enorme',
    gargantuan: 'Colosal',
  };

  const isCharacterToken = !!character?.id;
  const isEncounterParticipant = !!participant?.id;

  const displayName = useMemo(() => {
    const label = token?.label?.trim();
    if (label) return label;
    const cname = character?.name?.trim();
    if (cname) return cname;
    const pname = participant?.name?.trim();
    if (pname) return pname;
    return token?.type === 'ally' ? 'Aliado' : 'Enemigo';
  }, [token?.label, token?.type, character?.name, participant?.name]);

  const subtitle = useMemo(() => {
    if (!token) return '';
    const typeLabel = token.type === 'ally' ? 'Aliado' : 'Enemigo';
    if (isCharacterToken) return `${typeLabel} · Personaje`;
    if (isEncounterParticipant) return `${typeLabel} · Combate`;
    return typeLabel;
  }, [token, isCharacterToken, isEncounterParticipant]);

  const hydrateDraftFromData = useCallback((ch: CharacterPayload | null, p: EncounterParticipant | null) => {
    if (ch?.id) {
      setHpDraft({
        currentHp: typeof ch.currentHp === 'number' ? String(ch.currentHp) : '',
        maxHp: typeof ch.maxHp === 'number' ? String(ch.maxHp) : '',
        tempHp: typeof ch.tempHp === 'number' ? String(ch.tempHp) : '',
      });
      return;
    }
    if (p?.id) {
      setHpDraft({
        currentHp: typeof p.currentHp === 'number' ? String(p.currentHp) : '',
        maxHp: typeof p.maxHp === 'number' ? String(p.maxHp) : '',
        tempHp: '',
      });
      return;
    }
    setHpDraft({ currentHp: '', maxHp: '', tempHp: '' });
  }, []);

  const broadcastCampaignSync = useCallback((message: any) => {
    try {
      const bc = 'BroadcastChannel' in window ? new BroadcastChannel('campaign-sync') : null;
      bc?.postMessage(message);
      bc?.close();
    } catch {}
  }, []);

  // Load related data when opening or switching token.
  useEffect(() => {
    if (!open) return;
    if (!campaignId || !token?.id) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        // 1) Resolve encounter + participant from the app-wide ActiveEncounterContext
        let foundEncounter: EncounterSummary | null = null;
        let foundParticipant: EncounterParticipant | null = null;
        if (activeEncounterId) {
          try {
            const encounters = await listEncounters(campaignId);
            foundEncounter = encounters.find((e) => e.id === activeEncounterId) || null;
            foundParticipant = foundEncounter?.participants?.find((p) => p.id === token.id) || null;
          } catch {
            foundEncounter = null;
            foundParticipant = null;
          }
        }
        if (cancelled) return;
        setEncounter(foundEncounter);
        setParticipant(foundParticipant);

        // 3) Resolve character (best-effort). If not a character id, this will 404.
        let foundCharacter: CharacterPayload | null = null;
        try {
          foundCharacter = await getCharacter(token.id);
        } catch {
          foundCharacter = null;
        }
        if (cancelled) return;
        setCharacter(foundCharacter);

        hydrateDraftFromData(foundCharacter, foundParticipant);
      } catch (e: any) {
        if (cancelled) return;
        setLoadError(e?.message || 'No se pudo cargar información del token');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, campaignId, token?.id, activeEncounterId, hydrateDraftFromData]);

  // Re-hydrate notes draft when note changes
  useEffect(() => {
    if (!open) return;
    setNotesDraft(existingNote?.text || '');
  }, [open, existingNote?.text]);

  const img = useMemo(() => (token?.id ? resolveTokenImage(token.id) : undefined), [resolveTokenImage, token?.id]);
  const isDataUrl = !!img && /^data:/i.test(img);

  const onSaveHp = useCallback(async () => {
    if (!campaignId || !token?.id) return;

    const currentHp = clampMin(toIntOrUndef(hpDraft.currentHp), 0);
    const maxHp = clampMin(toIntOrUndef(hpDraft.maxHp), 0);
    const tempHp = clampMin(toIntOrUndef(hpDraft.tempHp), 0);

    setSavingHp(true);
    try {
      if (character?.id) {
        const next = await updateCharacter(character.id, {
          currentHp,
          maxHp,
          tempHp,
        });
        setCharacter(next);
        hydrateDraftFromData(next, participant);
        broadcastCampaignSync({ type: 'characterUpdated', campaignId, characterId: character.id, at: Date.now() });
        return;
      }

      if (activeEncounterId && encounter && participant?.id) {
        const nextParticipants = (encounter.participants || []).map((p) => {
          if (p.id !== participant.id) return p;
          return {
            ...p,
            currentHp,
            maxHp,
          };
        });
        const nextEnc = await updateEncounter(campaignId, activeEncounterId, { participants: nextParticipants });
        setEncounter(nextEnc);
        const nextP = nextEnc?.participants?.find((p) => p.id === participant.id) || null;
        setParticipant(nextP);
        hydrateDraftFromData(character, nextP);
        broadcastCampaignSync({ type: 'encounterUpdated', campaignId, encounterId: activeEncounterId, at: Date.now() });
      }
    } finally {
      setSavingHp(false);
    }
  }, [activeEncounterId, broadcastCampaignSync, campaignId, character, encounter, hpDraft.currentHp, hpDraft.maxHp, hpDraft.tempHp, hydrateDraftFromData, participant, token?.id]);

  const onSaveNotes = useCallback(async () => {
    if (!participantId) return;
    if (!campaignId || !activeEncounterId) return;

    const trimmed = (notesDraft || '').trim();
    setSavingNotes(true);
    try {
      if (!trimmed) {
        notes.removeNoteForParticipant(participantId);
        return;
      }
      const existing = notes.getNote(participantId);
      if (existing) {
        notes.updateNoteForParticipant(participantId, { text: trimmed });
      } else {
        notes.upsertNoteForParticipant(participantId, trimmed, false);
      }
    } finally {
      setSavingNotes(false);
    }
  }, [activeEncounterId, campaignId, notes, notesDraft, participantId]);

  const canEditNotes = !!campaignId && !!activeEncounterId && !!participantId;
  const canSaveHp = !!campaignId && !!token?.id && (isCharacterToken || (isEncounterParticipant && !!activeEncounterId));

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition ? { top: anchorPosition.top, left: anchorPosition.left } : undefined}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{ sx: { p: 1.25, minWidth: 260, maxWidth: 360 } }}
    >
      {!token ? null : (
        <Box>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
            {displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>

          {loadError ? (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              {loadError}
            </Typography>
          ) : null}

          <Divider sx={{ my: 1 }} />

          {img ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                  flex: '0 0 auto',
                  bgcolor: 'black',
                }}
              >
                {isDataUrl ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <img src={img} alt={token.label || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <AuthImage src={img} alt={token.label || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary">ID</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {token.id}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Sin imagen de token
            </Typography>
          )}

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField
              label="HP"
              size="small"
              type="number"
              value={hpDraft.currentHp ?? ''}
              onChange={(e) => setHpDraft((p) => ({ ...p, currentHp: e.target.value }))}
              inputProps={{ min: 0, step: 1 }}
              sx={{ width: 90 }}
              disabled={loading}
            />
            <TextField
              label="Max"
              size="small"
              type="number"
              value={hpDraft.maxHp ?? ''}
              onChange={(e) => setHpDraft((p) => ({ ...p, maxHp: e.target.value }))}
              inputProps={{ min: 0, step: 1 }}
              sx={{ width: 90 }}
              disabled={loading}
            />
            {isCharacterToken ? (
              <TextField
                label="Temp"
                size="small"
                type="number"
                value={hpDraft.tempHp ?? ''}
                onChange={(e) => setHpDraft((p) => ({ ...p, tempHp: e.target.value }))}
                inputProps={{ min: 0, step: 1 }}
                sx={{ width: 90 }}
                disabled={loading}
              />
            ) : null}
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={onSaveHp}
              disabled={!canSaveHp || savingHp || loading}
            >
              {savingHp ? 'Guardando…' : 'Guardar vida'}
            </Button>
            {character?.id ? (
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  onClose();
                  navigate(`/characters/${character.id}`);
                }}
              >
                Abrir ficha
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="small"
                disabled={!activeEncounterId}
                onClick={() => {
                  onClose();
                  navigate('/combat');
                }}
              >
                Abrir combate
              </Button>
            )}
          </Stack>

          <Divider sx={{ my: 1 }} />

          <TextField
            label="Notas"
            size="small"
            fullWidth
            multiline
            minRows={3}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder={canEditNotes ? 'Notas de combate (se guardan en este equipo)' : 'Requiere combate activo'}
            disabled={!canEditNotes}
          />

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={onSaveNotes}
              disabled={!canEditNotes || savingNotes}
            >
              {savingNotes ? 'Guardando…' : 'Guardar notas'}
            </Button>
            {canEditNotes && existingNote?.text ? (
              <Button
                variant="text"
                size="small"
                color="error"
                onClick={() => {
                  notes.removeNoteForParticipant(participantId!);
                  setNotesDraft('');
                }}
              >
                Borrar
              </Button>
            ) : null}
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Casilla: <strong>{token.cellKey}</strong> · Rotación: <strong>{Math.round(Number((token as any).rotationDeg ?? 0))}°</strong>
          </Typography>

          {onUpdateToken && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>Tamaño del token</Typography>
              <TextField
                select
                size="small"
                fullWidth
                label="Tamaño actual"
                value={token.size || 'medium'}
                onChange={(e) => {
                  const newSize = e.target.value as TokenSize;
                  onUpdateToken(token.id, {
                    size: newSize,
                    originalSize: token.originalSize || token.size || 'medium',
                  });
                }}
              >
                {TOKEN_SIZES.map((size) => (
                  <MenuItem key={size} value={size}>
                    {TOKEN_SIZE_LABELS[size]}
                    {(token.originalSize || token.size || 'medium') === size && ' (Original)'}
                  </MenuItem>
                ))}
              </TextField>
              {token.originalSize && token.size !== token.originalSize && (
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  sx={{ mt: 1 }}
                  onClick={() => {
                    onUpdateToken(token.id, { size: token.originalSize });
                  }}
                >
                  Restaurar a {TOKEN_SIZE_LABELS[token.originalSize]}
                </Button>
              )}
            </>
          )}
        </Box>
      )}
    </Popover>
  );
};
