import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type ReactQuill from 'react-quill';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';
import { RichTextEditor } from '../common/RichTextEditor';
import type { WorldpediaNoteFull, NoteLinkPayload } from '../../api/worldpedia/worldpediaApi';
import WorldpediaLinkInserter from './WorldpediaLinkInserter';
import WorldpediaBacklinks from './WorldpediaBacklinks';
import WorldpediaEntityViewer from './WorldpediaEntityViewer';
import WorldpediaNoteViewer from './WorldpediaNoteViewer';

interface Props {
  note: WorldpediaNoteFull;
  loading: boolean;
  campaignId: string;
  onSave: (noteId: string, data: { title?: string; html?: string | null; links?: NoteLinkPayload[] }) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
  /** Navigate to another note (e.g. from a note-link or backlink click). */
  onNavigateNote: (noteId: string) => void;
}

/**
 * Editor panel for a single Worldpedia note.
 *
 * Shows the title (editable), rich-text body, link insertion, and backlinks.
 */
export default function WorldpediaNoteEditor({ note, loading, campaignId, onSave, onDelete, onNavigateNote }: Props) {
  const { t } = useTranslation();

  const [title, setTitle] = useState(note.title);

  /**
   * HTML content stored in a ref (not state) to avoid re-rendering
   * ReactQuill on every keystroke.  The editor runs in uncontrolled
   * mode (`defaultValue`) so Quill manages its own DOM – we only
   * read this ref when saving.
   */
  const htmlRef = useRef(note.html ?? '');

  const [links, setLinks] = useState<NoteLinkPayload[]>(
    (note.links ?? []).map((l) => ({
      type: l.type,
      label: l.label,
      targetUrl: l.targetUrl,
      targetNoteId: l.targetNoteId,
      targetEntityType: l.targetEntityType,
      targetEntityId: l.targetEntityId,
    })),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  /**
   * Defer mounting the heavy Quill editor by one animation‑frame so the
   * lightweight parts (title, buttons, metadata) render instantly.
   */
  const [editorMounted, setEditorMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEditorMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Entity viewer drawer state
  const [entityViewerOpen, setEntityViewerOpen] = useState(false);
  const [viewerEntityType, setViewerEntityType] = useState<string | null>(null);
  const [viewerEntityId, setViewerEntityId] = useState<string | null>(null);

  // Note viewer drawer state (overlay preview of linked notes)
  const [noteViewerOpen, setNoteViewerOpen] = useState(false);
  const [viewerNoteId, setViewerNoteId] = useState<string | null>(null);

  /**
   * Container node for click delegation.
   * Stored in state (callback-ref pattern) so the effect re-runs when the
   * node mounts/unmounts (e.g. after a loading cycle).
   */
  const [editorContainerNode, setEditorContainerNode] = useState<HTMLDivElement | null>(null);

  /** Ref to the underlying ReactQuill instance (used for selection & inline formatting). */
  const quillEditorRef = useRef<ReactQuill | null>(null);

  /**
   * Quill selection range captured at the moment the user opens the link
   * dialog. Stored so we can apply the link format after the dialog closes.
   */
  const [savedRange, setSavedRange] = useState<{ index: number; length: number } | null>(null);

  /** Text currently selected in the editor (used as `initialLabel` for the dialog). */
  const [selectedText, setSelectedText] = useState('');

  /*
   * Note: state sync via useEffect is no longer needed because the parent
   * renders this component with `key={note.id}`, guaranteeing a fresh
   * mount whenever the active note changes.
   */

  /**
   * Opens the entity viewer drawer for a given entity type & id.
   */
  const openEntityViewer = useCallback((type: string, id: string) => {
    setViewerEntityType(type);
    setViewerEntityId(id);
    setEntityViewerOpen(true);
  }, []);

  /**
   * Opens the note viewer drawer to preview a linked note without leaving
   * the current editor.
   */
  const openNoteViewer = useCallback((targetNoteId: string) => {
    setViewerNoteId(targetNoteId);
    setNoteViewerOpen(true);
  }, []);

  /**
   * Click delegation on the Quill editor container.
   *
   * Intercepts clicks on `<a>` elements and routes them depending on the href:
   * - `worldpedia://note/{id}` → navigate to note
   * - `worldpedia://entity/{type}/{id}` → open entity viewer drawer
   * - Legacy `data-link-type` attributes are still supported.
   * - Any other `http(s)://` link → open in new tab.
   */
  useEffect(() => {
    if (!editorContainerNode) return;

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href') || '';

      /* ── worldpedia:// inline links ────────────────────────── */
      if (href.startsWith('worldpedia://note/')) {
        e.preventDefault();
        e.stopPropagation();
        const targetId = href.slice('worldpedia://note/'.length);
        if (targetId) openNoteViewer(targetId);
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
          if (eType && eId) openEntityViewer(eType, eId);
        }
        return;
      }

      /* ── Legacy data-link-type attributes ──────────────────── */
      const linkType = anchor.getAttribute('data-link-type');
      if (linkType === 'note') {
        e.preventDefault();
        e.stopPropagation();
        const targetNoteId = anchor.getAttribute('data-target-note-id');
        if (targetNoteId) openNoteViewer(targetNoteId);
      } else if (linkType === 'entity') {
        e.preventDefault();
        e.stopPropagation();
        const eType = anchor.getAttribute('data-entity-type');
        const eId = anchor.getAttribute('data-entity-id');
        if (eType && eId) openEntityViewer(eType, eId);
      } else if (linkType === 'url') {
        e.preventDefault();
        e.stopPropagation();
        const url = anchor.getAttribute('href') || anchor.getAttribute('data-target-url');
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    editorContainerNode.addEventListener('click', handleClick, true);
    return () => editorContainerNode.removeEventListener('click', handleClick, true);
  }, [editorContainerNode, openNoteViewer, openEntityViewer]);

  /* ── Handlers ──────────────────────────────────────────────────── */

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setDirty(true);
  }, []);

  const handleHtmlChange = useCallback((value: string) => {
    htmlRef.current = value;
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(note.id, { title, html: htmlRef.current, links });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [note.id, title, links, onSave]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(t('worldpedia_delete_note_confirm', 'Delete this note? This action cannot be undone.'))) return;
    await onDelete(note.id);
  }, [note.id, onDelete, t]);

  /**
   * Opens the link inserter dialog.
   *
   * Before opening, capture the current Quill selection so we can apply the
   * link format after the user picks a target.
   */
  const handleOpenLinkDialog = useCallback(() => {
    const editor = quillEditorRef.current?.getEditor();
    if (editor) {
      const range = editor.getSelection();
      if (range && range.length > 0) {
        setSavedRange(range);
        setSelectedText(editor.getText(range.index, range.length).trim());
      } else {
        setSavedRange(range);
        setSelectedText('');
      }
    } else {
      setSavedRange(null);
      setSelectedText('');
    }
    setLinkDialogOpen(true);
  }, []);

  /**
   * Builds the href for inline worldpedia links.
   */
  const buildLinkHref = useCallback((link: NoteLinkPayload): string => {
    if (link.type === 'url') return link.targetUrl || '#';
    if (link.type === 'note') return `worldpedia://note/${link.targetNoteId ?? ''}`;
    if (link.type === 'entity') return `worldpedia://entity/${link.targetEntityType ?? ''}/${link.targetEntityId ?? ''}`;
    return '#';
  }, []);

  /**
   * Called when the user finishes picking a link target in the dialog.
   *
   * Inserts an inline `<a>` on the selected text (or inserts new text at the
   * cursor) AND adds the link to the metadata array for backlink tracking.
   */
  const handleAddLink = useCallback(
    (link: NoteLinkPayload) => {
      const editor = quillEditorRef.current?.getEditor();
      const href = buildLinkHref(link);

      if (editor) {
        if (savedRange && savedRange.length > 0) {
          // Text was selected → format it as a link
          editor.formatText(savedRange.index, savedRange.length, 'link', href, 'user');
        } else {
          // No selection → insert the label as new linked text at cursor
          const insertAt = savedRange?.index ?? (editor.getLength() - 1);
          const linkText = link.label || href;
          editor.insertText(insertAt, linkText, 'link', href, 'user');
        }
      }

      // Also add to the metadata links array (for backend backlink tracking)
      setLinks((prev) => [...prev, link]);
      setDirty(true);
      setSavedRange(null);
      setSelectedText('');
    },
    [savedRange, buildLinkHref],
  );

  const handleRemoveLink = useCallback((index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }, []);

  /* ── Render ────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Title + actions */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          variant="standard"
          value={title}
          onChange={handleTitleChange}
          fullWidth
          inputProps={{ style: { fontSize: '1.5rem', fontWeight: 700 } }}
        />
        <Tooltip title={t('worldpedia_insert_link', 'Insert link')}>
          <IconButton onClick={handleOpenLinkDialog}>
            <LinkIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('save', 'Save')}>
          <span>
            <IconButton onClick={handleSave} color="primary" disabled={saving || !dirty}>
              <SaveIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('worldpedia_delete_note', 'Delete note')}>
          <IconButton onClick={handleDelete} color="error">
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Metadata */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {t('worldpedia_created_at', 'Created')}: {new Date(note.createdAt).toLocaleDateString()}
      </Typography>

      {/* Rich text editor – wrapped for click delegation on inline links */}
      <Box ref={setEditorContainerNode}>
        {editorMounted ? (
          <RichTextEditor
            defaultValue={note.html ?? ''}
            onChange={handleHtmlChange}
            placeholder={t('worldpedia_notes', 'Notes')}
            editorRef={quillEditorRef}
          />
        ) : (
          <Box sx={{ minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>

      {/* Links list */}
      {links.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t('worldpedia_links', 'Links')}</Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {links.map((link, idx) => {
              const label = link.label || link.targetUrl || link.targetNoteId || `${link.targetEntityType}:${link.targetEntityId}`;
              return (
                <Chip
                  key={idx}
                  label={label}
                  size="small"
                  variant="outlined"
                  color={link.type === 'url' ? 'default' : link.type === 'note' ? 'primary' : 'secondary'}
                  onClick={() => {
                    if (link.type === 'url' && link.targetUrl) {
                      window.open(link.targetUrl, '_blank', 'noopener,noreferrer');
                    } else if (link.type === 'note' && link.targetNoteId) {
                      openNoteViewer(link.targetNoteId);
                    } else if (link.type === 'entity' && link.targetEntityType && link.targetEntityId) {
                      openEntityViewer(link.targetEntityType, link.targetEntityId);
                    }
                  }}
                  onDelete={() => handleRemoveLink(idx)}
                />
              );
            })}
          </Stack>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Backlinks */}
      <WorldpediaBacklinks backlinks={note.backlinks ?? []} onNavigateNote={onNavigateNote} />

      {/* Link inserter dialog */}
      <WorldpediaLinkInserter
        open={linkDialogOpen}
        campaignId={campaignId}
        initialLabel={selectedText}
        onClose={() => {
          setLinkDialogOpen(false);
          setSavedRange(null);
          setSelectedText('');
        }}
        onInsert={handleAddLink}
      />

      {/* Entity viewer drawer (opened from entity-link chips or inline links) */}
      <WorldpediaEntityViewer
        open={entityViewerOpen}
        entityType={viewerEntityType}
        entityId={viewerEntityId}
        campaignId={campaignId}
        onClose={() => setEntityViewerOpen(false)}
      />

      {/* Note viewer drawer (overlays a read-only preview of a linked note) */}
      <WorldpediaNoteViewer
        open={noteViewerOpen}
        noteId={viewerNoteId}
        campaignId={campaignId}
        onClose={() => setNoteViewerOpen(false)}
        onNavigateNote={(id) => {
          setNoteViewerOpen(false);
          onNavigateNote(id);
        }}
        onOpenEntity={openEntityViewer}
      />
    </Box>
  );
}
