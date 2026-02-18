import { useCallback, useState } from 'react';
import {
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  CircularProgress,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DescriptionIcon from '@mui/icons-material/Description';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import type { WorldpediaTree, WorldpediaNoteLight, WorldpediaFolderWithNotes } from '../../api/worldpedia/worldpediaApi';
import WorldpediaFolderDialog from './WorldpediaFolderDialog';
import WorldpediaMoveDialog from './WorldpediaMoveDialog';
import WorldpediaImportExport from './WorldpediaImportExport';
import WorldpediaSearchBar from './WorldpediaSearchBar';

interface Props {
  tree: WorldpediaTree | null;
  loading: boolean;
  selectedNoteId: string | null;
  isMobile: boolean;
  onSelectNote: (note: WorldpediaNoteLight) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onCreateNote: (title: string, folderId: string | null) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onMoveNote: (noteId: string, folderId: string | null) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const SIDEBAR_WIDTH = 280;

/**
 * Left-side panel showing the folder/note tree, search bar, and action buttons.
 */
export default function WorldpediaSidebar({
  tree,
  loading,
  selectedNoteId,
  isMobile,
  onSelectNote,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateNote,
  onDeleteNote,
  onMoveNote,
  onRefresh,
}: Props) {
  const { t } = useTranslation();

  // Folder collapse state
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  // Dialogs
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<WorldpediaFolderWithNotes | null>(null);
  const [newNoteFolderId, setNewNoteFolderId] = useState<string | null | undefined>(undefined);
  const [moveDialogNote, setMoveDialogNote] = useState<WorldpediaNoteLight | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ anchorEl: HTMLElement; type: 'folder' | 'note'; item: any } | null>(null);

  /* ── Folder toggle ────────────────────────────────────────────── */

  const toggleFolder = useCallback((folderId: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  /* ── Context menu handlers ─────────────────────────────────────── */

  const handleContextMenuOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>, type: 'folder' | 'note', item: any) => {
      e.stopPropagation();
      setContextMenu({ anchorEl: e.currentTarget, type, item });
    },
    [],
  );

  const handleContextMenuClose = useCallback(() => setContextMenu(null), []);

  const handleContextAction = useCallback(
    async (action: string) => {
      if (!contextMenu) return;
      const { type, item } = contextMenu;
      handleContextMenuClose();

      if (type === 'folder') {
        if (action === 'rename') {
          setEditingFolder(item);
          setFolderDialogOpen(true);
        } else if (action === 'delete') {
          if (window.confirm(t('worldpedia_delete_folder_confirm', 'Delete this folder? Notes inside will be moved to root.'))) {
            await onDeleteFolder(item.id);
          }
        } else if (action === 'add-note') {
          setNewNoteFolderId(item.id);
        }
      } else if (type === 'note') {
        if (action === 'delete') {
          if (window.confirm(t('worldpedia_delete_note_confirm', 'Delete this note? This action cannot be undone.'))) {
            await onDeleteNote(item.id);
          }
        } else if (action === 'move') {
          setMoveDialogNote(item);
        }
      }
    },
    [contextMenu, handleContextMenuClose, onDeleteFolder, onDeleteNote, t],
  );

  /* ── Folder dialog ─────────────────────────────────────────────── */

  const handleFolderDialogClose = useCallback(() => {
    setFolderDialogOpen(false);
    setEditingFolder(null);
  }, []);

  const handleFolderDialogSave = useCallback(
    async (name: string) => {
      if (editingFolder) {
        await onRenameFolder(editingFolder.id, name);
      } else {
        await onCreateFolder(name);
      }
      handleFolderDialogClose();
    },
    [editingFolder, onCreateFolder, onRenameFolder, handleFolderDialogClose],
  );

  /* ── New note prompt (simple) ──────────────────────────────────── */

  const handleNewNoteConfirm = useCallback(
    async (title: string) => {
      await onCreateNote(title, newNoteFolderId ?? null);
      setNewNoteFolderId(undefined);
    },
    [onCreateNote, newNoteFolderId],
  );

  /* ── Search result click ───────────────────────────────────────── */

  const handleSearchSelect = useCallback(
    (note: WorldpediaNoteLight) => {
      onSelectNote(note);
    },
    [onSelectNote],
  );

  /* ── Render tree items ─────────────────────────────────────────── */

  const renderNoteItem = (note: WorldpediaNoteLight) => (
    <ListItem
      key={note.id}
      disablePadding
      secondaryAction={
        <IconButton size="small" onClick={(e) => handleContextMenuOpen(e, 'note', note)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      }
    >
      <ListItemButton
        selected={selectedNoteId === note.id}
        onClick={() => onSelectNote(note)}
        sx={{ pl: note.folderId ? 4 : 2 }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <DescriptionIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={note.title}
          primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
        />
      </ListItemButton>
    </ListItem>
  );

  const renderFolder = (folder: WorldpediaFolderWithNotes) => {
    const isOpen = openFolders.has(folder.id);
    return (
      <Box key={folder.id}>
        <ListItem
          disablePadding
          secondaryAction={
            <IconButton size="small" onClick={(e) => handleContextMenuOpen(e, 'folder', folder)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          }
        >
          <ListItemButton onClick={() => toggleFolder(folder.id)}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              {isOpen ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText
              primary={folder.name}
              primaryTypographyProps={{ noWrap: true, fontWeight: 600, variant: 'body2' }}
            />
            {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </ListItemButton>
        </ListItem>
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
          <List disablePadding>
            {folder.notes.map(renderNoteItem)}
          </List>
        </Collapse>
      </Box>
    );
  };

  /* ── Sidebar content ───────────────────────────────────────────── */

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: SIDEBAR_WIDTH }}>
      {/* Header actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          {t('worldpedia', 'Worldpedia')}
        </Typography>
        <Tooltip title={t('worldpedia_new_folder', 'New folder')}>
          <IconButton size="small" onClick={() => { setEditingFolder(null); setFolderDialogOpen(true); }}>
            <CreateNewFolderIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('worldpedia_new_note', 'New note')}>
          <IconButton size="small" onClick={() => setNewNoteFolderId(null)}>
            <NoteAddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <WorldpediaImportExport onRefresh={onRefresh} />
        <Tooltip title={t('loading', 'Refresh')}>
          <IconButton size="small" onClick={() => void onRefresh()}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Search */}
      <Box sx={{ px: 1, pb: 1 }}>
        <WorldpediaSearchBar onSelect={handleSearchSelect} />
      </Box>

      <Divider />

      {/* Tree */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : !tree ? null : (
          <List dense disablePadding>
            {tree.folders.map(renderFolder)}
            {tree.rootNotes.map(renderNoteItem)}
            {tree.folders.length === 0 && tree.rootNotes.length === 0 && (
              <Typography variant="body2" sx={{ p: 2, opacity: 0.5, textAlign: 'center' }}>
                {t('worldpedia_no_notes', 'No notes yet')}
              </Typography>
            )}
          </List>
        )}
      </Box>

      {/* Context menu */}
      <Menu anchorEl={contextMenu?.anchorEl} open={!!contextMenu} onClose={handleContextMenuClose}>
        {contextMenu?.type === 'folder' && [
          <MenuItem key="add-note" onClick={() => void handleContextAction('add-note')}>
            {t('worldpedia_new_note', 'New note')}
          </MenuItem>,
          <MenuItem key="rename" onClick={() => void handleContextAction('rename')}>
            {t('worldpedia_edit_folder', 'Edit folder')}
          </MenuItem>,
          <MenuItem key="delete" onClick={() => void handleContextAction('delete')}>
            {t('worldpedia_delete_folder', 'Delete folder')}
          </MenuItem>,
        ]}
        {contextMenu?.type === 'note' && [
          <MenuItem key="move" onClick={() => void handleContextAction('move')}>
            {t('worldpedia_move_note', 'Move note')}
          </MenuItem>,
          <MenuItem key="delete" onClick={() => void handleContextAction('delete')}>
            {t('worldpedia_delete_note', 'Delete note')}
          </MenuItem>,
        ]}
      </Menu>

      {/* Folder create/edit dialog */}
      <WorldpediaFolderDialog
        open={folderDialogOpen}
        initialName={editingFolder?.name ?? ''}
        onClose={handleFolderDialogClose}
        onSave={handleFolderDialogSave}
      />

      {/* New note dialog (simple prompt) */}
      <WorldpediaFolderDialog
        open={newNoteFolderId !== undefined}
        initialName=""
        titleLabel={t('worldpedia_note_title', 'Note title')}
        onClose={() => setNewNoteFolderId(undefined)}
        onSave={handleNewNoteConfirm}
      />

      {/* Move note dialog */}
      {moveDialogNote && tree && (
        <WorldpediaMoveDialog
          open
          folders={tree.folders}
          currentFolderId={moveDialogNote.folderId}
          onClose={() => setMoveDialogNote(null)}
          onMove={async (folderId) => {
            await onMoveNote(moveDialogNote.id, folderId);
            setMoveDialogNote(null);
          }}
        />
      )}
    </Box>
  );

  /* ── Mobile: use a temporary drawer.  Desktop: permanent box. ──── */

  if (isMobile) {
    return (
      <Drawer variant="temporary" open anchor="left" onClose={() => {}}>
        {sidebarContent}
      </Drawer>
    );
  }

  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {sidebarContent}
    </Box>
  );
}
