/**
 * Settings panel that lets users choose which tools appear in the sidebar
 * and in what order. Renders a reorderable list with visibility toggles.
 */
import {
  Box,
  Typography,
  Switch,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Divider,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useSidebarConfig } from '../contexts/SidebarConfigContext';
import { DEFAULT_SIDEBAR_ITEMS, type SidebarConfig } from '../constants/sidebarItems';

/** Local working-copy item. */
interface LocalItem {
  key: string;
  visible: boolean;
}

/**
 * SidebarSettings component.
 * Allows the user to toggle visibility and reorder sidebar shortcuts.
 */
const SidebarSettings = () => {
  const { t } = useTranslation();
  const { sidebarItems, saveSidebarConfig, resetSidebarConfig } = useSidebarConfig();

  // Local working copy so changes are batched until "save".
  const [items, setItems] = useState<LocalItem[]>([]);
  const [dirty, setDirty] = useState(false);

  // Sync from context whenever sidebarItems change externally.
  useEffect(() => {
    setItems(sidebarItems.map((i) => ({ ...i })));
    setDirty(false);
  }, [sidebarItems]);

  /** Resolves a human-readable label for a sidebar key. */
  const labelFor = (key: string) => {
    const def = DEFAULT_SIDEBAR_ITEMS.find((d) => d.key === key);
    return def ? t(def.labelKey, def.fallback) : key;
  };

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
   * Moves an item up or down in the list.
   *
   * @param idx - Current index.
   * @param direction - -1 for up, 1 for down.
   */
  const move = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
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

      <List dense disablePadding>
        {items.map((item, idx) => (
          <ListItem
            key={item.key}
            disablePadding
            secondaryAction={
              <Switch
                edge="end"
                size="small"
                checked={item.visible}
                onChange={() => toggleVisibility(idx)}
              />
            }
            sx={{ pr: 7 }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
              <DragIndicatorIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={labelFor(item.key)}
              primaryTypographyProps={{
                variant: 'body2',
                sx: { opacity: item.visible ? 1 : 0.5 },
              }}
            />
            <IconButton
              size="small"
              disabled={idx === 0}
              onClick={() => move(idx, -1)}
              sx={{ mr: 0.25 }}
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              disabled={idx === items.length - 1}
              onClick={() => move(idx, 1)}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </ListItem>
        ))}
      </List>

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
