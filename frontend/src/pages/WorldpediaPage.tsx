import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useCampaignId } from '../hooks/useCampaignId';
import {
  getWorldpediaTree,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  createFolder,
  updateFolder,
  deleteFolder,
  moveNote,
  reorderWorldpedia,
  type WorldpediaTree,
  type WorldpediaNoteFull,
  type WorldpediaNoteLight,
  type NoteLinkPayload,
  type ReorderItem,
} from '../api/worldpedia/worldpediaApi';
import WorldpediaSidebar from '../components/Worldpedia/WorldpediaSidebar';
import WorldpediaNoteEditor from '../components/Worldpedia/WorldpediaNoteEditor';

/**
 * Main page for the Worldpedia module.
 *
 * Displays a two-panel layout: a folder/note tree on the left and the
 * note editor on the right.
 */
export default function WorldpediaPage() {
  const { t } = useTranslation();
  const campaignId = useCampaignId();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [tree, setTree] = useState<WorldpediaTree | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<WorldpediaNoteFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [treeLoading, setTreeLoading] = useState(false);

  /* ── Load tree ─────────────────────────────────────────────────── */

  const loadTree = useCallback(async () => {
    if (!campaignId) return;
    setTreeLoading(true);
    try {
      const data = await getWorldpediaTree(campaignId);
      setTree(data);
    } catch {
      /* silent – tree stays null */
    } finally {
      setTreeLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  /* ── Load note ─────────────────────────────────────────────────── */

  const loadNote = useCallback(
    async (noteId: string) => {
      if (!campaignId) return;
      setLoading(true);
      try {
        const data = await getNote(campaignId, noteId);
        setActiveNote(data);
        setSelectedNoteId(noteId);
      } catch {
        setActiveNote(null);
      } finally {
        setLoading(false);
      }
    },
    [campaignId],
  );

  /* ── Handlers forwarded to children ────────────────────────────── */

  const handleSelectNote = useCallback(
    (note: WorldpediaNoteLight) => {
      void loadNote(note.id);
    },
    [loadNote],
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      if (!campaignId) return;
      await createFolder(campaignId, { name });
      await loadTree();
    },
    [campaignId, loadTree],
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, name: string) => {
      if (!campaignId) return;
      await updateFolder(campaignId, folderId, { name });
      await loadTree();
    },
    [campaignId, loadTree],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      if (!campaignId) return;
      await deleteFolder(campaignId, folderId);
      await loadTree();
    },
    [campaignId, loadTree],
  );

  const handleCreateNote = useCallback(
    async (title: string, folderId: string | null) => {
      if (!campaignId) return;
      const note = await createNote(campaignId, { title, folderId });
      await loadTree();
      if (note) void loadNote(note.id);
    },
    [campaignId, loadTree, loadNote],
  );

  const handleSaveNote = useCallback(
    async (noteId: string, data: { title?: string; html?: string | null; links?: NoteLinkPayload[] }) => {
      if (!campaignId) return;
      const updated = await updateNote(campaignId, noteId, data);
      setActiveNote(updated);
      await loadTree();
    },
    [campaignId, loadTree],
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (!campaignId) return;
      await deleteNote(campaignId, noteId);
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
        setActiveNote(null);
      }
      await loadTree();
    },
    [campaignId, selectedNoteId, loadTree],
  );

  const handleMoveNote = useCallback(
    async (noteId: string, folderId: string | null) => {
      if (!campaignId) return;
      await moveNote(campaignId, noteId, folderId);
      await loadTree();
      // Refresh note if it's the active one
      if (selectedNoteId === noteId) void loadNote(noteId);
    },
    [campaignId, selectedNoteId, loadTree, loadNote],
  );

  /**
   * Batch reorder callback invoked after drag-and-drop in the sidebar.
   */
  const handleReorder = useCallback(
    async (data: { folders?: ReorderItem[]; notes?: ReorderItem[] }) => {
      if (!campaignId) return;
      await reorderWorldpedia(campaignId, data);
      await loadTree();
    },
    [campaignId, loadTree],
  );

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel: folder/note tree */}
      <WorldpediaSidebar
        campaignId={campaignId}
        tree={tree}
        loading={treeLoading}
        selectedNoteId={selectedNoteId}
        isMobile={isMobile}
        onSelectNote={handleSelectNote}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
        onMoveNote={handleMoveNote}
        onReorder={handleReorder}
        onRefresh={loadTree}
      />

      {/* Right panel: note editor or empty state */}
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, md: 3 } }}>
        {activeNote ? (
          <WorldpediaNoteEditor
            key={activeNote.id}
            note={activeNote}
            loading={loading}
            campaignId={campaignId}
            onSave={handleSaveNote}
            onDelete={handleDeleteNote}
            onNavigateNote={loadNote}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
            <Typography variant="h6">{t('worldpedia_select_note', 'Select a note to view or edit')}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
