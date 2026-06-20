/**
 * Settings panel that lets users choose which tools appear in the sidebar
 * and in what order. Renders a drag-and-drop reorderable list with
 * visibility toggles and per-item icons.
 */
import {
  Box,
  Typography,
  Switch,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Divider,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MapIcon from '@mui/icons-material/Map';
import PeopleIcon from '@mui/icons-material/People';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PetsIcon from '@mui/icons-material/Pets';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import BoltIcon from '@mui/icons-material/Bolt';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import StyleIcon from '@mui/icons-material/Style';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, type ReactElement } from 'react';
import { useSidebarConfig } from '../contexts/SidebarConfigContext';
import { DEFAULT_SIDEBAR_ITEMS, type SidebarConfig } from '../constants/sidebarItems';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/** Maps iconName strings to MUI icon elements. */
const ICON_MAP: Record<string, ReactElement> = {
  FolderSpecial: <FolderSpecialIcon fontSize="small" />,
  Bolt: <BoltIcon fontSize="small" />,
  MusicNote: <MusicNoteIcon fontSize="small" />,
  MenuBook: <MenuBookIcon fontSize="small" />,
  Map: <MapIcon fontSize="small" />,
  SportsKabaddi: <SportsKabaddiIcon fontSize="small" />,
  People: <PeopleIcon fontSize="small" />,
  Assignment: <AssignmentIcon fontSize="small" />,
  Storefront: <StorefrontIcon fontSize="small" />,
  AutoStories: <AutoStoriesIcon fontSize="small" />,
  EventNote: <EventNoteIcon fontSize="small" />,
  Pets: <PetsIcon fontSize="small" />,
  AutoFixHigh: <AutoFixHighIcon fontSize="small" />,
  TheaterComedy: <TheaterComedyIcon fontSize="small" />,
  Style: <StyleIcon fontSize="small" />,
};

/** Local working-copy item. */
interface LocalItem {
  key: string;
  visible: boolean;
}

/**
 * A single sortable sidebar-item row.
 */
function SortableItem({
  item,
  onToggle,
}: {
  item: LocalItem;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const def = DEFAULT_SIDEBAR_ITEMS.find((d) => d.key === item.key);
  const label = def ? t(def.labelKey, def.fallback) : item.key;
  const icon = def ? ICON_MAP[def.iconName] : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      secondaryAction={
        <Switch
          edge="end"
          size="small"
          checked={item.visible}
          onChange={onToggle}
        />
      }
      sx={{ pr: 7 }}
    >
      <ListItemIcon
        {...attributes}
        {...listeners}
        sx={{ minWidth: 28, cursor: 'grab', color: 'text.secondary' }}
      >
        <DragIndicatorIcon fontSize="small" />
      </ListItemIcon>
      {icon && (
        <ListItemIcon sx={{ minWidth: 32, opacity: item.visible ? 1 : 0.4 }}>
          {icon}
        </ListItemIcon>
      )}
      <ListItemText
        primary={label}
        primaryTypographyProps={{
          variant: 'body2',
          sx: { opacity: item.visible ? 1 : 0.5 },
        }}
      />
    </ListItem>
  );
}

/**
 * SidebarSettings component.
 * Allows the user to toggle visibility and reorder sidebar shortcuts
 * via drag-and-drop.
 */
const SidebarSettings = () => {
  const { t } = useTranslation();
  const { sidebarItems, saveSidebarConfig, resetSidebarConfig } = useSidebarConfig();

  // Local working copy so changes are batched until "save".
  const [items, setItems] = useState<LocalItem[]>([]);
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Sync from context whenever sidebarItems change externally.
  useEffect(() => {
    setItems(sidebarItems.map((i) => ({ ...i })));
    setDirty(false);
  }, [sidebarItems]);

  /**
   * Toggles the visibility flag for the item at the given index.
   *
   * @param idx - Index of the item to toggle.
   */
  const toggleVisibility = (idx: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], visible: !next[idx].visible };
      return next;
    });
    setDirty(true);
  };

  /**
   * Handles the end of a drag-and-drop reorder.
   *
   * @param event - DnD drag-end event.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.key === active.id);
      const newIndex = prev.findIndex((i) => i.key === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setDirty(true);
  };

  /** Persists the current state to backend. */
  const handleSave = async () => {
    const config: SidebarConfig = { items: items.map((i) => ({ key: i.key, visible: i.visible })) };
    await saveSidebarConfig(config);
    setDirty(false);
  };

  /** Resets to defaults. */
  const handleReset = async () => {
    await resetSidebarConfig();
    setDirty(false);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('sidebar_settings_hint', 'Activa o desactiva herramientas y cambia su orden en el sidebar.')}
      </Typography>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.key)}
          strategy={verticalListSortingStrategy}
        >
          <List dense disablePadding>
            {items.map((item, idx) => (
              <SortableItem
                key={item.key}
                item={item}
                onToggle={() => toggleVisibility(idx)}
              />
            ))}
          </List>
        </SortableContext>
      </DndContext>

      <Divider sx={{ my: 1.5 }} />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" disabled={!dirty} onClick={handleSave}>
          {t('save', 'Guardar')}
        </Button>
        <Button size="small" variant="outlined" onClick={handleReset}>
          {t('sidebar_settings_reset', 'Restablecer')}
        </Button>
      </Box>
    </Box>
  );
};

export default SidebarSettings;
