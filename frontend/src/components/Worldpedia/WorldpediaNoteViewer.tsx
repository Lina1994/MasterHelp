import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import { getNote, type WorldpediaNoteFull } from '../../api/worldpedia/worldpediaApi';

interface Props {
  /** Whether the drawer is open. */
  open: boolean;
  /** The ID of the note to preview. */
  noteId: string | null;
  /** Active campaign ID, needed for the API call. */
  campaignId: string;
  /** Close the drawer. */
  onClose: () => void;
  /**
   * Navigate to a note for editing (replaces the main editor).
   * Called when the user clicks "open in editor" or follows a note
   * link inside the preview.
   */
  onNavigateNote: (noteId: string) => void;
  /**
   * Open the entity viewer drawer.
   * Called when the user clicks an inline entity link inside the preview.
   */
  onOpenEntity?: (entityType: string, entityId: string) => void;
}

/**
 * A slide-out drawer that displays a Worldpedia note in read-only mode.
 *
 * It is used when the user clicks a note-to-note link (whether inline in the
 * rich-text body or in the footer chips) so that the source note stays open
 * underneath.  The previewed note supports its own inline worldpedia links:
 *
 * - `worldpedia://note/{id}` → replaces the preview with the target note.
 * - `worldpedia://entity/{type}/{id}` → opens the entity viewer.
 * - Regular `http(s)://` → opens in a new browser tab.
 */
export default function WorldpediaNoteViewer({
  open,
  noteId,
  campaignId,
  onClose,
  onNavigateNote,
  onOpenEntity,
}: Props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<WorldpediaNoteFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Internal stack so the user can follow note→note links inside the viewer. */
  const [noteStack, setNoteStack] = useState<string[]>([]);

  /** The ID actually shown (either the prop or the top of the internal stack). */
  const activeNoteId = noteStack.length > 0 ? noteStack[noteStack.length - 1] : noteId;

  /**
   * Container node for click delegation.
   * Stored in state (callback-ref pattern) so the effect re-runs when the
   * node mounts/unmounts (e.g. after a loading cycle).
   */
  const [htmlContainerNode, setHtmlContainerNode] = useState<HTMLDivElement | null>(null);

  /* ── Fetch note when activeNoteId changes ──────────────────────── */

  useEffect(() => {
    if (!open || !activeNoteId) {
      setNote(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await getNote(campaignId, activeNoteId);
        if (!cancelled) setNote(data);
      } catch {
        if (!cancelled) setError(t('worldpedia_note_load_error', 'Failed to load note.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, activeNoteId, campaignId, t]);

  /* Reset internal stack when the drawer is opened for a brand-new note */
  useEffect(() => {
    if (open) {
      setNoteStack([]);
    }
  }, [open, noteId]);

  /* ── Click delegation on rendered HTML ─────────────────────────── */

  useEffect(() => {
    if (!htmlContainerNode) return;

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href') || '';

      if (href.startsWith('worldpedia://note/')) {
        e.preventDefault();
        e.stopPropagation();
        const id = href.slice('worldpedia://note/'.length);
        if (id) setNoteStack((prev) => [...prev, id]);
        return;
      }

      if (href.startsWith('worldpedia://entity/')) {
        e.preventDefault();
        e.stopPropagation();
        const rest = href.slice('worldpedia://entity/'.length);
        const slashIdx = rest.indexOf('/');
        if (slashIdx > 0) {
          const eType = rest.slice(0, slashIdx);
          const eId = rest.slice(slashIdx + 1);
          if (eType && eId) onOpenEntity?.(eType, eId);
        }
        return;
      }

      /* Regular URL → open in new tab */
      if (href.startsWith('http://') || href.startsWith('https://')) {
        e.preventDefault();
        e.stopPropagation();
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    };

    htmlContainerNode.addEventListener('click', handleClick, true);
    return () => htmlContainerNode.removeEventListener('click', handleClick, true);
  }, [htmlContainerNode, onOpenEntity]);

  /* ── "Open in editor" navigates away and closes drawer ─────────── */

  const handleOpenInEditor = useCallback(() => {
    if (activeNoteId) {
      onNavigateNote(activeNoteId);
      onClose();
    }
  }, [activeNoteId, onNavigateNote, onClose]);

  /* ── Back inside the internal stack ────────────────────────────── */

  const handleBack = useCallback(() => {
    setNoteStack((prev) => prev.slice(0, -1));
  }, []);

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{ m: 0, pr: 12, fontWeight: 700 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {noteStack.length > 0 && (
            <IconButton size="small" onClick={handleBack} title={t('back', 'Back')}>
              ←
            </IconButton>
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {note?.title ?? t('worldpedia_note', 'Note')}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <IconButton size="small" onClick={handleOpenInEditor} title={t('worldpedia_open_in_editor', 'Open in editor')}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* Body */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Typography color="error" sx={{ py: 2 }}>
            {error}
          </Typography>
        )}

        {!loading && !error && note && (
          <Box
            ref={setHtmlContainerNode}
            className="ql-editor"
            sx={{
              /* Reuse Quill's .ql-editor styles so the note looks identical to
                 the writer's view (lists, headings, indentation, etc.). */
              '& a': { color: 'primary.main', cursor: 'pointer', textDecoration: 'underline' },
              '& img': { maxWidth: '100%', borderRadius: 1 },
            }}
            dangerouslySetInnerHTML={{ __html: note.html ?? '' }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
