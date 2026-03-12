/**
 * CharacterRelationsSection.tsx
 *
 * Displays the affinity-link relationships of a single character within the
 * character sheet / editor, allowing masters to create, edit and delete links
 * from inside the sheet. Changes are reflected immediately in the Afinigrama,
 * and vice-versa (both use the same /affinity-links endpoint).
 *
 * Props:
 *  - charId     : UUID of the character whose relations to display.
 *  - campaignId : UUID of the active campaign.
 *  - isMaster   : Whether the viewer can create / edit / delete links.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import {
  listAffinityLinks,
  createAffinityLink,
  updateAffinityLink,
  deleteAffinityLink,
  type AffinityLinkPayload,
} from '../../api/affinityLinks';
import { listCharacters, type CharacterPayload } from '../../api/characters';
import { SheetSection } from './charSheetShared';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const LINK_COLORS = [
  '#90caf9', '#ef5350', '#66bb6a', '#ffa726', '#ab47bc',
  '#26c6da', '#ec407a', '#d4e157', '#8d6e63', '#78909c',
];

const SENTIMENTS: { value: number; emoji: string; label: string }[] = [
  { value: -3, emoji: '😡', label: 'Odio' },
  { value: -2, emoji: '😤', label: 'Rencor' },
  { value: -1, emoji: '😒', label: 'Desconfianza' },
  { value: 0,  emoji: '😐', label: 'Indiferencia' },
  { value: 1,  emoji: '🤝', label: 'Respeto' },
  { value: 2,  emoji: '😊', label: 'Admiración' },
  { value: 3,  emoji: '❤️', label: 'Amor' },
];

function sentimentEmoji(value: number): string {
  return SENTIMENTS.find((s) => s.value === value)?.emoji ?? '😐';
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface Props {
  /** UUID of the character whose relations to display. */
  charId: string;
  /** UUID of the active campaign. */
  campaignId: string;
  /** Whether the viewer can manage links (create / edit / delete). */
  isMaster?: boolean;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

/**
 * Renders a "Relaciones" section showing all affinity links that involve the
 * given character. Masters can create, edit and delete links from here.
 */
const CharacterRelationsSection: React.FC<Props> = ({ charId, campaignId, isMaster = false }) => {
  const { t } = useTranslation();

  /* ── data ── */
  const [links, setLinks] = useState<AffinityLinkPayload[]>([]);
  const [characters, setCharacters] = useState<CharacterPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── create dialog ── */
  const [addOpen, setAddOpen] = useState(false);
  const [addCharB, setAddCharB] = useState('');
  const [addLabelAtoB, setAddLabelAtoB] = useState('');
  const [addLabelBtoA, setAddLabelBtoA] = useState('');
  const [addSentiment, setAddSentiment] = useState(0);
  const [addColor, setAddColor] = useState(LINK_COLORS[0]);
  const [addNotes, setAddNotes] = useState('');

  /* ── edit dialog ── */
  const [editLink, setEditLink] = useState<AffinityLinkPayload | null>(null);
  const [editLabelAtoB, setEditLabelAtoB] = useState('');
  const [editLabelBtoA, setEditLabelBtoA] = useState('');
  const [editSentiment, setEditSentiment] = useState(0);
  const [editColor, setEditColor] = useState(LINK_COLORS[0]);
  const [editNotes, setEditNotes] = useState('');

  const [saving, setSaving] = useState(false);

  /* ── load ── */
  const load = useCallback(async () => {
    if (!campaignId || !charId) return;
    setLoading(true);
    setError(null);
    try {
      const [allLinks, allChars] = await Promise.all([
        listAffinityLinks(campaignId),
        listCharacters(campaignId),
      ]);
      setLinks(allLinks.filter(
        (l) => l.characterA.id === charId || l.characterB.id === charId,
      ));
      setCharacters(allChars.filter((c) => c.id !== charId));
    } catch (err: any) {
      setError(err.response?.data?.message || t('error_loading_relations', 'Error al cargar relaciones'));
    } finally {
      setLoading(false);
    }
  }, [campaignId, charId, t]);

  useEffect(() => { load(); }, [load]);

  /* ── helpers ── */
  /**
   * Given a link, returns the "other" character (not the one this sheet belongs to).
   *
   * @param link - Affinity link to inspect.
   * @returns The character that is NOT charId.
   */
  function otherChar(link: AffinityLinkPayload): AffinityLinkPayload['characterA'] {
    return link.characterA.id === charId ? link.characterB : link.characterA;
  }

  /**
   * Returns the directional label FROM this character toward the other one.
   *
   * @param link - Affinity link to inspect.
   */
  function labelFromThis(link: AffinityLinkPayload): string {
    return link.characterA.id === charId ? link.labelAtoB : link.labelBtoA;
  }

  /**
   * Returns the directional label FROM the other character toward this one.
   *
   * @param link - Affinity link to inspect.
   */
  function labelFromOther(link: AffinityLinkPayload): string {
    return link.characterA.id === charId ? link.labelBtoA : link.labelAtoB;
  }

  /* ── create ── */
  const openAdd = () => {
    setAddCharB('');
    setAddLabelAtoB('');
    setAddLabelBtoA('');
    setAddSentiment(0);
    setAddColor(LINK_COLORS[0]);
    setAddNotes('');
    setAddOpen(true);
  };

  const handleCreate = async () => {
    if (!addCharB) return;
    setSaving(true);
    try {
      await createAffinityLink({
        campaignId,
        characterAId: charId,
        characterBId: addCharB,
        labelAtoB: addLabelAtoB,
        labelBtoA: addLabelBtoA,
        sentiment: addSentiment,
        color: addColor,
        notes: addNotes || undefined,
      });
      setAddOpen(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || t('error_creating_link', 'Error al crear el vínculo'));
    } finally {
      setSaving(false);
    }
  };

  /* ── edit ── */
  const openEdit = (link: AffinityLinkPayload) => {
    setEditLink(link);
    // Normalise so that editLabelAtoB is always "this character → other"
    setEditLabelAtoB(link.characterA.id === charId ? link.labelAtoB : link.labelBtoA);
    setEditLabelBtoA(link.characterA.id === charId ? link.labelBtoA : link.labelAtoB);
    setEditSentiment(link.sentiment);
    setEditColor(link.color);
    setEditNotes(link.notes ?? '');
  };

  const handleUpdate = async () => {
    if (!editLink) return;
    setSaving(true);
    try {
      // Re-orient labels to match the original A→B / B→A direction stored in the entity
      const patch = editLink.characterA.id === charId
        ? { labelAtoB: editLabelAtoB, labelBtoA: editLabelBtoA }
        : { labelAtoB: editLabelBtoA, labelBtoA: editLabelAtoB };
      await updateAffinityLink(editLink.id, {
        ...patch,
        sentiment: editSentiment,
        color: editColor,
        notes: editNotes || undefined,
      });
      setEditLink(null);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || t('error_updating_link', 'Error al actualizar el vínculo'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editLink) return;
    setSaving(true);
    try {
      await deleteAffinityLink(editLink.id);
      setEditLink(null);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || t('error_deleting_link', 'Error al eliminar el vínculo'));
    } finally {
      setSaving(false);
    }
  };

  /* ── render helpers ── */
  const thisChar = links[0]
    ? (links[0].characterA.id === charId ? links[0].characterA : links[0].characterB)
    : null;

  const otherCharName = (link: AffinityLinkPayload) => otherChar(link).name;

  /* ── render ── */
  return (
    <SheetSection title={t('relations', 'Relaciones')}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
          {error}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={22} />
        </Box>
      ) : links.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('no_relations', 'Este personaje no tiene vínculos registrados.')}
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {links.map((link) => {
            const other = otherChar(link);
            const lFrom = labelFromThis(link);
            const lTo = labelFromOther(link);
            const hasImage = other.tokenKind === 'image' && other.tokenImageUrl;
            return (
              <Box
                key={link.id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  p: 1,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderLeft: `4px solid ${link.color}`,
                  bgcolor: 'background.paper',
                }}
              >
                {/* Avatar */}
                <Avatar
                  src={hasImage ? other.tokenImageUrl : undefined}
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: other.tokenColor || '#607d8b',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {!hasImage && initials(other.name)}
                </Avatar>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {other.name}
                    </Typography>
                    <Typography variant="caption" title={SENTIMENTS.find((s) => s.value === link.sentiment)?.label}>
                      {sentimentEmoji(link.sentiment)}
                    </Typography>
                    <Chip
                      size="small"
                      label={other.kind === 'pc' ? 'PC' : 'NPC'}
                      sx={{ height: 16, fontSize: '0.6rem' }}
                    />
                  </Stack>

                  {/* Directional labels */}
                  {lFrom && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      → {lFrom}
                    </Typography>
                  )}
                  {lTo && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      ← {lTo}
                    </Typography>
                  )}

                  {/* Notes */}
                  {link.notes && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: 'block',
                        mt: 0.5,
                        fontStyle: 'italic',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {link.notes}
                    </Typography>
                  )}
                </Box>

                {/* Edit button (master only) */}
                {isMaster && (
                  <Tooltip title={t('edit_link', 'Editar vínculo')}>
                    <IconButton size="small" onClick={() => openEdit(link)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      {/* Add button */}
      {isMaster && (
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={openAdd}
          sx={{ mt: 1.5 }}
        >
          {t('new_link', 'Nuevo vínculo')}
        </Button>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('new_relationship', 'Nueva relación')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('other_character', 'Otro personaje')}</InputLabel>
              <Select
                value={addCharB}
                label={t('other_character', 'Otro personaje')}
                onChange={(e) => setAddCharB(e.target.value)}
              >
                {characters.map((c) => (
                  <MenuItem key={c.id} value={c.id!}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Labels — always from the perspective of THIS character */}
            <TextField
              label={`${t('this_char_label', 'Este personaje')} → ${characters.find((c) => c.id === addCharB)?.name ?? '...'}`}
              value={addLabelAtoB}
              onChange={(e) => setAddLabelAtoB(e.target.value)}
              size="small"
              fullWidth
              placeholder={t('label_atob_placeholder', 'Ej: es hijo de')}
            />
            <TextField
              label={`${characters.find((c) => c.id === addCharB)?.name ?? '...'} → ${t('this_char_label', 'Este personaje')}`}
              value={addLabelBtoA}
              onChange={(e) => setAddLabelBtoA(e.target.value)}
              size="small"
              fullWidth
              placeholder={t('label_btoa_placeholder', 'Ej: es madre de')}
            />

            {/* Sentiment */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('sentiment', 'Sentimiento')}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {SENTIMENTS.map((s) => (
                  <Tooltip key={s.value} title={s.label} arrow>
                    <Box
                      onClick={() => setAddSentiment(s.value)}
                      sx={{
                        width: 36, height: 36,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, borderRadius: '50%', cursor: 'pointer',
                        border: addSentiment === s.value ? '2px solid white' : '2px solid transparent',
                        bgcolor: addSentiment === s.value ? 'action.selected' : 'transparent',
                      }}
                    >
                      {s.emoji}
                    </Box>
                  </Tooltip>
                ))}
              </Stack>
            </Box>

            {/* Color */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('link_color', 'Color de la línea')}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {LINK_COLORS.map((c) => (
                  <Box
                    key={c}
                    onClick={() => setAddColor(c)}
                    sx={{
                      width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                      border: addColor === c ? '3px solid white' : '2px solid transparent',
                      boxShadow: addColor === c ? `0 0 0 2px ${c}` : 'none',
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Notes */}
            <TextField
              label={t('link_notes', 'Notas')}
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder={t('link_notes_placeholder', 'Historia, secretos o contexto de esta relación...')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>{t('cancel', 'Cancelar')}</Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={saving || !addCharB}
          >
            {saving ? t('saving', 'Guardando...') : t('create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editLink} onClose={() => setEditLink(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('edit_relationship', 'Editar relación')}</DialogTitle>
        <DialogContent>
          {editLink && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {/* Always show "este personaje ↔ otro" regardless of A/B order */}
                {thisChar?.name ?? '?'} ↔ {otherCharName(editLink)}
              </Typography>

              {/* Labels */}
              <TextField
                label={`${t('this_char_label', 'Este personaje')} → ${otherCharName(editLink)}`}
                value={editLabelAtoB}
                onChange={(e) => setEditLabelAtoB(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label={`${otherCharName(editLink)} → ${t('this_char_label', 'Este personaje')}`}
                value={editLabelBtoA}
                onChange={(e) => setEditLabelBtoA(e.target.value)}
                size="small"
                fullWidth
              />

              {/* Sentiment */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('sentiment', 'Sentimiento')}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {SENTIMENTS.map((s) => (
                    <Tooltip key={s.value} title={s.label} arrow>
                      <Box
                        onClick={() => setEditSentiment(s.value)}
                        sx={{
                          width: 36, height: 36,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 20, borderRadius: '50%', cursor: 'pointer',
                          border: editSentiment === s.value ? '2px solid white' : '2px solid transparent',
                          bgcolor: editSentiment === s.value ? 'action.selected' : 'transparent',
                        }}
                      >
                        {s.emoji}
                      </Box>
                    </Tooltip>
                  ))}
                </Stack>
              </Box>

              {/* Color */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('link_color', 'Color de la línea')}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {LINK_COLORS.map((c) => (
                    <Box
                      key={c}
                      onClick={() => setEditColor(c)}
                      sx={{
                        width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                        border: editColor === c ? '3px solid white' : '2px solid transparent',
                        boxShadow: editColor === c ? `0 0 0 2px ${c}` : 'none',
                      }}
                    />
                  ))}
                </Stack>
              </Box>

              {/* Notes */}
              <TextField
                label={t('link_notes', 'Notas')}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                size="small"
                fullWidth
                multiline
                minRows={2}
                placeholder={t('link_notes_placeholder', 'Historia, secretos o contexto de esta relación...')}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {editLink && (
            <Tooltip title={t('delete_link', 'Eliminar vínculo')}>
              <IconButton color="error" onClick={handleDelete} disabled={saving}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={() => setEditLink(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={handleUpdate} variant="contained" disabled={saving}>
            {saving ? t('saving', 'Guardando...') : t('save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </SheetSection>
  );
};

export default CharacterRelationsSection;
