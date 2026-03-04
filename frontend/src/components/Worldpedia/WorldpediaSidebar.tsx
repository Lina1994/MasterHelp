import { useCallback, useMemo, useState } from 'react';
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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTranslation } from 'react-i18next';
import type { WorldpediaTree, WorldpediaNoteLight, WorldpediaFolderWithNotes } from '../../api/worldpedia/worldpediaApi';
import type { ReorderItem } from '../../api/worldpedia/worldpediaApi';
import WorldpediaFolderDialog from './WorldpediaFolderDialog';
import WorldpediaMoveDialog from './WorldpediaMoveDialog';
import WorldpediaSearchBar from './WorldpediaSearchBar';
import WorldpediaAutoLinksDialog from './WorldpediaAutoLinksDialog';

import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ═══════════════════════════ Types ═══════════════════════════════════ */

interface Props {
  /** Campaign ID used to scope the auto-links settings. */
  campaignId: string;
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
  /** Batch reorder callback after drag-and-drop. */
  onReorder: (data: { folders?: ReorderItem[]; notes?: ReorderItem[] }) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const SIDEBAR_WIDTH = 280;

/** Prefix to distinguish folder sortable ids from note sortable ids. */
const FOLDER_PREFIX = 'folder::';
const NOTE_PREFIX = 'note::';
/** Prefix for explicit folder drop zones (handles empty-folder drops). */
const FOLDER_DROP_PREFIX = 'folder-drop::';

/**
 * Custom collision detection: prioritises folder drop-zones so that
 * notes can be reliably dropped into empty (or any) folders.
 */
const folderAwareCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const folderDrop = pointerCollisions.find((c) => String(c.id).startsWith(FOLDER_DROP_PREFIX));
  if (folderDrop) return [folderDrop];
  return closestCenter(args);
};

/* ═══════════════════════════ Sortable items ══════════════════════════ */

/**
 * A single draggable + sortable note row.
 */
function SortableNoteItem({
  note,
  selected,
  indented,
  onSelect,
  onContextMenu,
}: {
  note: WorldpediaNoteLight;
  selected: boolean;
  indented: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: NOTE_PREFIX + note.id,
    data: { type: 'note', note },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      secondaryAction={
        <IconButton size="small" onClick={onContextMenu}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      }
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{ display: 'flex', alignItems: 'center', pl: 0.5, cursor: 'grab', color: 'text.secondary' }}
      >
        <DragIndicatorIcon sx={{ fontSize: 16 }} />
      </Box>
      <ListItemButton
        selected={selected}
        onClick={onSelect}
        sx={{ pl: indented ? 2 : 1 }}
      >
        <ListItemIcon sx={{ minWidth: 28 }}>
          <DescriptionIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={note.title}
          primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
        />
      </ListItemButton>
    </ListItem>
  );
}

/**
 * A single draggable + sortable folder row (header only; children rendered separately).
 */
function SortableFolderItem({
  folder,
  isOpen,
  onToggle,
  onContextMenu,
  dragOver,
}: {
  folder: WorldpediaFolderWithNotes;
  isOpen: boolean;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  dragOver: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: FOLDER_PREFIX + folder.id,
    data: { type: 'folder', folder },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      secondaryAction={
        <IconButton size="small" onClick={onContextMenu}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      }
      sx={dragOver ? { bgcolor: 'action.hover', borderRadius: 1 } : undefined}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{ display: 'flex', alignItems: 'center', pl: 0.5, cursor: 'grab', color: 'text.secondary' }}
      >
        <DragIndicatorIcon sx={{ fontSize: 16 }} />
      </Box>
      <ListItemButton onClick={onToggle}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          {isOpen ? <FolderOpenIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
        </ListItemIcon>
        <ListItemText
          primary={folder.name}
          primaryTypographyProps={{ noWrap: true, fontWeight: 600, variant: 'body2' }}
        />
        {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ListItemButton>
    </ListItem>
  );
}

/**
 * Droppable zone shown inside each folder while a note is being dragged.
 * Ensures notes can always be dropped into a folder — even if it is empty.
 */
function FolderDropZone({ folderId }: { folderId: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: FOLDER_DROP_PREFIX + folderId,
    data: { type: 'folder-drop', folderId },
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        height: 28,
        mx: 2,
        my: 0.5,
        borderRadius: 1,
        border: '1px dashed',
        borderColor: isOver ? 'primary.main' : 'divider',
        bgcolor: isOver ? 'action.hover' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6 }}>
        Drop here
      </Typography>
    </Box>
  );
}

/* ═══════════════════════════ Main sidebar ════════════════════════════ */

/**
 * Left-side panel showing the folder/note tree, search bar, and action buttons.
 * Supports drag-and-drop to reorder folders, reorder notes within a folder,
 * and move notes between folders (or to root).
 */
export default function WorldpediaSidebar({
  campaignId,
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
  onReorder,
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

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overFolderId, setOverFolderId] = useState<string | null>(null);

  // Local tree copy for optimistic reordering
  const [localTree, setLocalTree] = useState<WorldpediaTree | null>(null);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Use the local tree (if set during drag) or the prop tree
  const effectiveTree = localTree ?? tree;

  /* ── DnD sensors ──────────────────────────────────────────────── */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  /* ── Sortable ids ─────────────────────────────────────────────── */

  /** All sortable ids for the top-level list (folders + folder notes + root notes). */
  const topLevelIds = useMemo(() => {
    if (!effectiveTree) return [];
    const ids: string[] = [];
    for (const f of effectiveTree.folders) {
      ids.push(FOLDER_PREFIX + f.id);
      for (const n of f.notes) {
        ids.push(NOTE_PREFIX + n.id);
      }
    }
    for (const n of effectiveTree.rootNotes) {
      ids.push(NOTE_PREFIX + n.id);
    }
    return ids;
  }, [effectiveTree]);

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

  /* ── DnD helpers ───────────────────────────────────────────────── */

  /**
   * Finds in which container (folder or root) a note lives.
   */
  const findNoteContainer = useCallback(
    (noteId: string, t: WorldpediaTree): { folderId: string | null; notes: WorldpediaNoteLight[] } | null => {
      for (const f of t.folders) {
        const idx = f.notes.findIndex((n) => n.id === noteId);
        if (idx !== -1) return { folderId: f.id, notes: f.notes };
      }
      const idx = t.rootNotes.findIndex((n) => n.id === noteId);
      if (idx !== -1) return { folderId: null, notes: t.rootNotes };
      return null;
    },
    [],
  );

  /* ── DnD handlers ──────────────────────────────────────────────── */

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    // Snapshot tree for optimistic updates
    if (tree) {
      setLocalTree(JSON.parse(JSON.stringify(tree)));
    }
  }, [tree]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) { setOverFolderId(null); return; }

    const overId = String(over.id);
    const activeIdStr = String(active.id);

    // Highlight folder when a note hovers over it
    if (activeIdStr.startsWith(NOTE_PREFIX) && overId.startsWith(FOLDER_PREFIX)) {
      setOverFolderId(overId.replace(FOLDER_PREFIX, ''));
    } else {
      setOverFolderId(null);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverFolderId(null);

    if (!over || !localTree) { setLocalTree(null); return; }

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    if (activeIdStr === overIdStr) { setLocalTree(null); return; }

    const isActiveFolder = activeIdStr.startsWith(FOLDER_PREFIX);
    const isActiveNote = activeIdStr.startsWith(NOTE_PREFIX);

    /* ── Folder reorder ─────────────────────────────────────────── */
    if (isActiveFolder && overIdStr.startsWith(FOLDER_PREFIX)) {
      const activeFolderId = activeIdStr.replace(FOLDER_PREFIX, '');
      const overFolderIdStr = overIdStr.replace(FOLDER_PREFIX, '');
      const oldIndex = localTree.folders.findIndex((f) => f.id === activeFolderId);
      const newIndex = localTree.folders.findIndex((f) => f.id === overFolderIdStr);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newFolders = arrayMove(localTree.folders, oldIndex, newIndex);
        const updatedTree = { ...localTree, folders: newFolders };
        setLocalTree(updatedTree);

        const folderItems: ReorderItem[] = newFolders.map((f, i) => ({ id: f.id, position: i }));
        try {
          await onReorder({ folders: folderItems });
        } catch { /* revert handled by refresh */ }
        setLocalTree(null);
        return;
      }
    }

    /* ── Note reorder / move ─────────────────────────────────────── */
    if (isActiveNote) {
      const activeNoteId = activeIdStr.replace(NOTE_PREFIX, '');

      // Determine target container
      let targetFolderId: string | null = null;
      if (overIdStr.startsWith(FOLDER_DROP_PREFIX)) {
        targetFolderId = overIdStr.replace(FOLDER_DROP_PREFIX, '');
      } else if (overIdStr.startsWith(FOLDER_PREFIX)) {
        targetFolderId = overIdStr.replace(FOLDER_PREFIX, '');
      } else if (overIdStr.startsWith(NOTE_PREFIX)) {
        const overNoteId = overIdStr.replace(NOTE_PREFIX, '');
        const container = findNoteContainer(overNoteId, localTree);
        if (container) targetFolderId = container.folderId;
      }

      // Find source container
      const sourceContainer = findNoteContainer(activeNoteId, localTree);
      if (!sourceContainer) { setLocalTree(null); return; }

      const srcFolderId = sourceContainer.folderId;
      const activeNote = sourceContainer.notes.find((n) => n.id === activeNoteId);
      if (!activeNote) { setLocalTree(null); return; }

      // Get target notes array
      const getTargetNotes = (): WorldpediaNoteLight[] => {
        if (targetFolderId === null) return localTree.rootNotes;
        const folder = localTree.folders.find((f) => f.id === targetFolderId);
        return folder?.notes ?? localTree.rootNotes;
      };

      if (srcFolderId === targetFolderId) {
        // Same container: reorder
        const notes = getTargetNotes();
        const oldIdx = notes.findIndex((n) => n.id === activeNoteId);
        let newIdx: number;
        if (overIdStr.startsWith(NOTE_PREFIX)) {
          const overNoteId = overIdStr.replace(NOTE_PREFIX, '');
          newIdx = notes.findIndex((n) => n.id === overNoteId);
        } else {
          newIdx = notes.length - 1;
        }

        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(notes, oldIdx, newIdx);
          const updatedTree = { ...localTree };
          if (targetFolderId === null) {
            updatedTree.rootNotes = reordered;
          } else {
            updatedTree.folders = updatedTree.folders.map((f) =>
              f.id === targetFolderId ? { ...f, notes: reordered } : f,
            );
          }
          setLocalTree(updatedTree);

          const noteItems: ReorderItem[] = reordered.map((n, i) => ({
            id: n.id,
            position: i,
            folderId: targetFolderId,
          }));
          try {
            await onReorder({ notes: noteItems });
          } catch { /* revert handled by refresh */ }
        }
      } else {
        // Cross-container: remove from source, insert into target
        const updatedTree = { ...localTree };

        // Remove from source
        if (srcFolderId === null) {
          updatedTree.rootNotes = updatedTree.rootNotes.filter((n) => n.id !== activeNoteId);
        } else {
          updatedTree.folders = updatedTree.folders.map((f) =>
            f.id === srcFolderId ? { ...f, notes: f.notes.filter((n) => n.id !== activeNoteId) } : f,
          );
        }

        // Insert into target
        let targetNotes: WorldpediaNoteLight[];
        if (targetFolderId === null) {
          targetNotes = [...updatedTree.rootNotes];
        } else {
          const targetFolder = updatedTree.folders.find((f) => f.id === targetFolderId);
          targetNotes = targetFolder ? [...targetFolder.notes] : [];
        }

        let insertIdx = targetNotes.length;
        if (overIdStr.startsWith(NOTE_PREFIX)) {
          const overNoteId = overIdStr.replace(NOTE_PREFIX, '');
          const overIdx = targetNotes.findIndex((n) => n.id === overNoteId);
          if (overIdx !== -1) insertIdx = overIdx;
        }
        targetNotes.splice(insertIdx, 0, { ...activeNote, folderId: targetFolderId });

        if (targetFolderId === null) {
          updatedTree.rootNotes = targetNotes;
        } else {
          updatedTree.folders = updatedTree.folders.map((f) =>
            f.id === targetFolderId ? { ...f, notes: targetNotes } : f,
          );
        }

        setLocalTree(updatedTree);

        // Auto-expand target folder
        if (targetFolderId) {
          setOpenFolders((prev) => { const n = new Set(prev); n.add(targetFolderId); return n; });
        }

        // Build reorder payload: all notes in both containers
        const noteItems: ReorderItem[] = targetNotes.map((n, i) => ({
          id: n.id,
          position: i,
          folderId: targetFolderId,
        }));
        const sourceNotes = srcFolderId === null
          ? updatedTree.rootNotes
          : (updatedTree.folders.find((f) => f.id === srcFolderId)?.notes ?? []);
        const sourceItems: ReorderItem[] = sourceNotes.map((n, i) => ({
          id: n.id,
          position: i,
          folderId: srcFolderId,
        }));

        try {
          await onReorder({ notes: [...noteItems, ...sourceItems] });
        } catch { /* revert handled by refresh */ }
      }
    }

    setLocalTree(null);
  }, [localTree, findNoteContainer, onReorder]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverFolderId(null);
    setLocalTree(null);
  }, []);

  /* ── Drag overlay content ──────────────────────────────────────── */

  const dragOverlayContent = useMemo(() => {
    if (!activeId || !effectiveTree) return null;

    if (activeId.startsWith(FOLDER_PREFIX)) {
      const folderId = activeId.replace(FOLDER_PREFIX, '');
      const folder = effectiveTree.folders.find((f) => f.id === folderId);
      if (!folder) return null;
      return (
        <ListItem disablePadding sx={{ bgcolor: 'background.paper', boxShadow: 3, borderRadius: 1, opacity: 0.9 }}>
          <ListItemButton>
            <ListItemIcon sx={{ minWidth: 28 }}><FolderIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary={folder.name} primaryTypographyProps={{ noWrap: true, fontWeight: 600, variant: 'body2' }} />
          </ListItemButton>
        </ListItem>
      );
    }
    if (activeId.startsWith(NOTE_PREFIX)) {
      const noteId = activeId.replace(NOTE_PREFIX, '');
      let note: WorldpediaNoteLight | undefined;
      for (const f of effectiveTree.folders) {
        note = f.notes.find((n) => n.id === noteId);
        if (note) break;
      }
      if (!note) note = effectiveTree.rootNotes.find((n) => n.id === noteId);
      if (!note) return null;
      return (
        <ListItem disablePadding sx={{ bgcolor: 'background.paper', boxShadow: 3, borderRadius: 1, opacity: 0.9 }}>
          <ListItemButton>
            <ListItemIcon sx={{ minWidth: 28 }}><DescriptionIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary={note.title} primaryTypographyProps={{ noWrap: true, variant: 'body2' }} />
          </ListItemButton>
        </ListItem>
      );
    }
    return null;
  }, [activeId, effectiveTree]);

  /* ── Render tree items ─────────────────────────────────────────── */

  const renderNoteItem = useCallback(
    (note: WorldpediaNoteLight, indented: boolean) => (
      <SortableNoteItem
        key={note.id}
        note={note}
        selected={selectedNoteId === note.id}
        indented={indented}
        onSelect={() => onSelectNote(note)}
        onContextMenu={(e) => handleContextMenuOpen(e, 'note', note)}
      />
    ),
    [selectedNoteId, onSelectNote, handleContextMenuOpen],
  );

  const renderFolder = useCallback(
    (folder: WorldpediaFolderWithNotes) => {
      const isDraggingNote = activeId != null && activeId.startsWith(NOTE_PREFIX);
      const isOpen = openFolders.has(folder.id) || isDraggingNote;
      const isDragOver = overFolderId === folder.id;
      return (
        <Box key={folder.id}>
          <SortableFolderItem
            folder={folder}
            isOpen={isOpen}
            onToggle={() => toggleFolder(folder.id)}
            onContextMenu={(e) => handleContextMenuOpen(e, 'folder', folder)}
            dragOver={isDragOver}
          />
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <List disablePadding>
              {folder.notes.map((note) => renderNoteItem(note, true))}
              {isDraggingNote && <FolderDropZone folderId={folder.id} />}
            </List>
          </Collapse>
        </Box>
      );
    },
    [openFolders, toggleFolder, handleContextMenuOpen, renderNoteItem, overFolderId, activeId],
  );

  /* ── Sidebar content ───────────────────────────────────────────── */

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: SIDEBAR_WIDTH }}>
      {/* Header actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t('worldpedia', 'Worldpedia')}
        </Typography>
        {/* All action icons grouped so they never get clipped by the sidebar boundary */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
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
          <Tooltip title={t('worldpedia_settings', 'Ajustes')}>
            <IconButton size="small" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ px: 1, pb: 1 }}>
        <WorldpediaSearchBar onSelect={handleSearchSelect} />
      </Box>

      <Divider />

      {/* Tree with DnD */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : !effectiveTree ? null : (
          <DndContext
            sensors={sensors}
            collisionDetection={folderAwareCollision}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
              <List dense disablePadding>
                {effectiveTree.folders.map(renderFolder)}
                {effectiveTree.rootNotes.map((n) => renderNoteItem(n, false))}
                {effectiveTree.folders.length === 0 && effectiveTree.rootNotes.length === 0 && (
                  <Typography variant="body2" sx={{ p: 2, opacity: 0.5, textAlign: 'center' }}>
                    {t('worldpedia_no_notes', 'No notes yet')}
                  </Typography>
                )}
              </List>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {dragOverlayContent}
            </DragOverlay>
          </DndContext>
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
      {moveDialogNote && effectiveTree && (
        <WorldpediaMoveDialog
          open
          folders={effectiveTree.folders}
          currentFolderId={moveDialogNote.folderId}
          onClose={() => setMoveDialogNote(null)}
          onMove={async (folderId) => {
            await onMoveNote(moveDialogNote.id, folderId);
            setMoveDialogNote(null);
          }}
        />
      )}

      {/* Settings dialog (gear icon) */}
      <WorldpediaAutoLinksDialog
        open={settingsOpen}
        campaignId={campaignId}
        onRefresh={onRefresh}
        onClose={() => setSettingsOpen(false)}
      />
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
