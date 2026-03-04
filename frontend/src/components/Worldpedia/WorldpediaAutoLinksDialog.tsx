/**
 * WorldpediaAutoLinksDialog.tsx
 *
 * Settings dialog for managing Worldpedia Auto-link rules.
 *
 * An auto-link rule maps a plain-text keyword to a link target (URL,
 * Worldpedia note, or app entity). Whenever the keyword appears as
 * unlinked text in a note, it is automatically rendered as a hyperlink.
 *
 * Rules are stored in localStorage per campaign.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTranslation } from 'react-i18next';
import {
  type AutoLinkRule,
  loadAutoLinkRules,
  saveAutoLinkRules,
} from '../../utils/worldpediaAutoLinks';
import type { NoteLinkPayload } from '../../api/worldpedia/worldpediaApi';
import WorldpediaLinkInserter from './WorldpediaLinkInserter';
import WorldpediaImportExport from './WorldpediaImportExport';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generates a simple UUID v4 for rule IDs (no external dependency). */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns a human-readable string describing a link payload.
 *
 * @param link  - The link payload.
 * @param label - The stored label for the rule.
 */
function linkDescription(link: NoteLinkPayload, label: string): string {
  if (label) return label;
  if (link.type === 'url') return link.targetUrl ?? 'URL';
  if (link.type === 'note') return `Nota: ${link.targetNoteId ?? ''}`;
  if (link.type === 'entity')
    return `${link.targetEntityType ?? ''}: ${link.targetEntityId ?? ''}`;
  return '—';
}

/** Colour for the Chip badge that shows the link type. */
function chipColor(type: NoteLinkPayload['type']): 'default' | 'primary' | 'secondary' {
  if (type === 'note') return 'primary';
  if (type === 'entity') return 'secondary';
  return 'default';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Whether the dialog is open. */
  open: boolean;
  /** Campaign ID used to scope the localStorage key. */
  campaignId: string;
  /** Called by import/export and the refresh button to reload the tree. */
  onRefresh: () => Promise<void>;
  /** Called when the dialog should be closed. */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * WorldpediaAutoLinksDialog
 *
 * Displays and manages the list of auto-link rules. The user can:
 * - View the existing rules (keyword → link target).
 * - Add a new rule by typing a keyword and picking a link via the
 *   standard `WorldpediaLinkInserter` dialog.
 * - Delete individual rules.
 *
 * All changes are persisted immediately to localStorage.
 */
export default function WorldpediaAutoLinksDialog({ open, campaignId, onRefresh, onClose }: Props) {
  const { t } = useTranslation();

  /** The live list of rules for this campaign. */
  const [rules, setRules] = useState<AutoLinkRule[]>([]);

  /** Keyword for the new-rule form. */
  const [newKeyword, setNewKeyword] = useState('');

  /** Link payload selected for the new rule (set after the inserter dialog). */
  const [pendingLink, setPendingLink] = useState<NoteLinkPayload | null>(null);

  /** Human-readable label for the selected link (shown as a badge in the form). */
  const [pendingLabel, setPendingLabel] = useState('');

  /** Whether the WorldpediaLinkInserter sub-dialog is open. */
  const [inserterOpen, setInserterOpen] = useState(false);

  /** Error message shown in the add-rule form. */
  const [formError, setFormError] = useState('');

  /** Whether the existing-rules list is expanded. Collapsed by default to keep the form visible. */
  const [rulesExpanded, setRulesExpanded] = useState(false);

  /* Load rules from localStorage each time the dialog opens */
  useEffect(() => {
    if (open) {
      setRules(loadAutoLinkRules(campaignId));
      setNewKeyword('');
      setPendingLink(null);
      setPendingLabel('');
      setFormError('');
      setRulesExpanded(false);
    }
  }, [open, campaignId]);

  /* ── Delete ──────────────────────────────────────────────────────── */

  /**
   * Removes a rule by its id and persists the updated list.
   *
   * @param id - The rule id to remove.
   */
  const handleDelete = useCallback(
    (id: string) => {
      setRules((prev) => {
        const next = prev.filter((r) => r.id !== id);
        saveAutoLinkRules(campaignId, next);
        return next;
      });
    },
    [campaignId],
  );

  /* ── Link selection via inserter ────────────────────────────────── */

  /**
   * Called when the user confirms a link in the WorldpediaLinkInserter.
   * Stores the selected payload and its label locally; does NOT add the
   * rule yet — the user still needs to confirm with "Add".
   *
   * @param link - The selected link payload.
   */
  const handleLinkSelected = useCallback((link: NoteLinkPayload) => {
    setPendingLink(link);
    const resolved =
      link.label ||
      link.targetUrl ||
      (link.type === 'note' ? `Nota` : '') ||
      (link.type === 'entity' ? `${link.targetEntityType}` : '') ||
      '—';
    setPendingLabel(resolved);
    setFormError('');
  }, []);

  /* ── Computed: is the current keyword a duplicate? ─────────────── */

  const isDuplicateKeyword =
    newKeyword.trim() !== '' &&
    rules.some((r) => r.keyword.toLowerCase() === newKeyword.trim().toLowerCase());

  /* ── Add rule ────────────────────────────────────────────────────── */

  /**
   * Validates the form, creates the rule, persists it, and resets the form.
   */
  const handleAdd = useCallback(() => {
    const kw = newKeyword.trim();
    if (!kw) {
      setFormError(t('autolinks_keyword_required', 'El campo de keyword es obligatorio.'));
      return;
    }
    if (!pendingLink) {
      setFormError(t('autolinks_target_required', 'Selecciona un destino para el enlace.'));
      return;
    }
    if (isDuplicateKeyword) {
      // Already blocked by the disabled button; guard here just in case.
      setFormError(t('autolinks_keyword_exists', 'Ya existe un auto-enlace con esa palabra clave.'));
      return;
    }

    const newRule: AutoLinkRule = {
      id: uuidv4(),
      keyword: kw,
      link: pendingLink,
      label: pendingLabel,
    };

    setRules((prev) => {
      const next = [...prev, newRule];
      saveAutoLinkRules(campaignId, next);
      return next;
    });

    // Reset form
    setNewKeyword('');
    setPendingLink(null);
    setPendingLabel('');
    setFormError('');
  }, [newKeyword, pendingLink, pendingLabel, isDuplicateKeyword, rules, campaignId, t]);

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('worldpedia_settings', 'Ajustes de Worldpedia')}
        </DialogTitle>

        <DialogContent dividers>
          {/* ── Section: Datos (Import / Export / Refresh) ────── */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('worldpedia_data_section', 'Datos')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t(
              'worldpedia_data_description',
              'Exporta o importa toda la Worldpedia de esta campaña, o refresca el árbol de notas.',
            )}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <WorldpediaImportExport onRefresh={onRefresh} />
            <Tooltip title={t('refresh', 'Actualizar')}>
              <IconButton size="small" onClick={() => void onRefresh()}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* ── Section: Auto-links ───────────────────────────── */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('autolinks_title', 'Auto-enlaces')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'autolinks_description',
              'Configura palabras clave que se convertirán automáticamente en enlaces al leer una nota. El reemplazo es sensible a mayúsculas en pantalla pero la detección no lo es.',
            )}
          </Typography>

          {/* ── Existing rules (collapsible) ───────────────── */}
          <Box
            onClick={() => setRulesExpanded((v) => !v)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              mb: rulesExpanded ? 1 : 2,
              gap: 0.5,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
              {t('autolinks_existing', 'Reglas configuradas')}
              {rules.length > 0 && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  ({rules.length})
                </Typography>
              )}
            </Typography>
            <IconButton size="small" tabIndex={-1}>
              {rulesExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>

          <Collapse in={rulesExpanded}>
            {rules.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                {t('autolinks_empty', 'No hay auto-enlaces configurados.')}
              </Typography>
            ) : (
              <Stack spacing={0.75} sx={{ mb: 2 }}>
                {rules.map((rule) => (
                  <Paper
                    key={rule.id}
                    variant="outlined"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 2,
                    }}
                  >
                    {/* Keyword */}
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, minWidth: 80, flexShrink: 0 }}
                    >
                      {rule.keyword}
                    </Typography>

                    {/* Arrow + type badge + target label */}
                    <Typography variant="body2" color="text.disabled" sx={{ flexShrink: 0 }}>
                      →
                    </Typography>
                    <Chip
                      size="small"
                      label={rule.link.type}
                      color={chipColor(rule.link.type)}
                      variant="outlined"
                      sx={{ flexShrink: 0 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={linkDescription(rule.link, rule.label)}
                    >
                      {linkDescription(rule.link, rule.label)}
                    </Typography>

                    {/* Delete */}
                    <Tooltip title={t('delete', 'Eliminar')}>
                      <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(rule.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Paper>
                ))}
              </Stack>
            )}
          </Collapse>

          <Divider sx={{ my: 2 }} />

          {/* ── Add new rule form ─────────────────────────────── */}
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            {t('autolinks_add', 'Añadir auto-enlace')}
          </Typography>

          <Stack spacing={1.5}>
            {/* Keyword */}
            <TextField
              size="small"
              label={t('autolinks_keyword', 'Palabra clave')}
              value={newKeyword}
              onChange={(e) => { setNewKeyword(e.target.value); setFormError(''); }}
              placeholder={t('autolinks_keyword_placeholder', 'Ej: Hércules')}
              error={isDuplicateKeyword}
              helperText={
                isDuplicateKeyword
                  ? t('autolinks_keyword_exists', 'Ya existe un auto-enlace con esa palabra clave.')
                  : t(
                      'autolinks_keyword_hint',
                      'El texto exacto a detectar (la detección es insensible a mayúsculas).',
                    )
              }
            />

            {/* Link target picker */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={() => setInserterOpen(true)}
                >
                  {pendingLink
                    ? t('autolinks_change_target', 'Cambiar destino')
                    : t('autolinks_pick_target', 'Seleccionar destino')}
                </Button>
                {pendingLink && (
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Chip
                      size="small"
                      label={pendingLink.type}
                      color={chipColor(pendingLink.type)}
                      variant="outlined"
                    />
                    <Typography variant="body2" noWrap sx={{ maxWidth: 180 }} title={pendingLabel}>
                      {pendingLabel}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Box>

            {/* Error */}
            {formError && (
              <Typography variant="caption" color="error">
                {formError}
              </Typography>
            )}

            {/* Submit */}
            <Box>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleAdd}
                disabled={!newKeyword.trim() || !pendingLink || isDuplicateKeyword}
              >
                {t('autolinks_add_btn', 'Añadir regla')}
              </Button>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>{t('close', 'Cerrar')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── WorldpediaLinkInserter for picking the link target ── */}
      <WorldpediaLinkInserter
        open={inserterOpen}
        campaignId={campaignId}
        initialLabel={newKeyword}
        onClose={() => setInserterOpen(false)}
        onInsert={handleLinkSelected}
      />
    </>
  );
}
