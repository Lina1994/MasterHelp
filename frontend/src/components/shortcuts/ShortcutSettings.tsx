import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { DndContext, closestCenter, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useShortcuts } from '../../contexts/ShortcutsContext';
import type { ShortcutItem, ShortcutPanelModifierKey, ShortcutShellConfig } from '../../types/shortcuts';

const MODIFIER_OPTIONS: Array<{ value: ShortcutPanelModifierKey; label: string }> = [
  { value: 'ctrl', label: 'Ctrl' },
  { value: 'alt', label: 'Alt' },
  { value: 'shift', label: 'Shift' },
  { value: 'meta', label: 'Meta' },
];

const UNASSIGNED_PANEL_ID = '__unassigned__';

const ensureUniquePanelName = (name: string, existingNames: Set<string>): string => {
  if (!existingNames.has(name.toLowerCase())) return name;
  let suffix = 2;
  while (existingNames.has(`${name.toLowerCase()} ${suffix}`)) {
    suffix += 1;
  }
  return `${name} ${suffix}`;
};

const SortableShortcutRow = ({ shortcut }: { shortcut: ShortcutItem }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: shortcut.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      style={style}
      sx={{
        p: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
          {shortcut.name}
        </Typography>
        {shortcut.hotkey ? (
          <Typography variant="caption" color="text.secondary" noWrap>
            {shortcut.hotkey}
          </Typography>
        ) : null}
      </Box>
      <IconButton size="small" {...attributes} {...listeners}>
        <DragIndicatorIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
};

const DroppableLane = ({ id, children }: { id: string; children: ReactNode }) => {
  const { setNodeRef } = useDroppable({ id });
  return <Box ref={setNodeRef}>{children}</Box>;
};

const findContainerForShortcut = (layout: Record<string, string[]>, shortcutId: string): string | null => {
  const entry = Object.entries(layout).find(([, shortcutIds]) => shortcutIds.includes(shortcutId));
  return entry ? entry[0] : null;
};

const moveShortcutBetweenContainers = (
  layout: Record<string, string[]>,
  shortcutId: string,
  fromContainerId: string,
  toContainerId: string,
  overId: string,
): Record<string, string[]> => {
  const source = [...(layout[fromContainerId] || [])];
  const target = [...(layout[toContainerId] || [])];
  const sourceIndex = source.indexOf(shortcutId);
  if (sourceIndex === -1) return layout;

  if (fromContainerId === toContainerId) {
    const overIndex = source.indexOf(overId);
    const nextList = overIndex === -1 ? source : arrayMove(source, sourceIndex, overIndex);
    return {
      ...layout,
      [fromContainerId]: nextList,
    };
  }

  source.splice(sourceIndex, 1);

  const overIndex = target.indexOf(overId);
  if (overIndex === -1) {
    target.push(shortcutId);
  } else {
    target.splice(overIndex, 0, shortcutId);
  }

  return {
    ...layout,
    [fromContainerId]: source,
    [toContainerId]: target,
  };
};

const buildLayoutFromDraft = (
  draft: ShortcutShellConfig,
  shortcuts: ShortcutItem[],
): Record<string, string[]> => {
  const shortcutById = new Map(shortcuts.map((shortcut) => [shortcut.id, shortcut]));
  const panelIds = draft.panels.map((panel) => panel.id);
  const panelIdSet = new Set(panelIds);
  const assignment = new Map<string, string | null>();

  shortcuts.forEach((shortcut) => {
    const mapped = draft.shortcutPanelMap[shortcut.id]?.[0];
    if (mapped && panelIdSet.has(mapped)) {
      assignment.set(shortcut.id, mapped);
      return;
    }
    if (shortcut.showInSidebarPanel || shortcut.showInHotbar) {
      assignment.set(shortcut.id, 'base');
      return;
    }
    assignment.set(shortcut.id, null);
  });

  const layout: Record<string, string[]> = {
    [UNASSIGNED_PANEL_ID]: [],
  };

  panelIds.forEach((panelId) => {
    const assignedIds = shortcuts
      .filter((shortcut) => assignment.get(shortcut.id) === panelId)
      .map((shortcut) => shortcut.id);

    const persistedOrder = (draft.panelShortcutOrder[panelId] || [])
      .filter((shortcutId) => assignedIds.includes(shortcutId));

    const missing = assignedIds
      .filter((shortcutId) => !persistedOrder.includes(shortcutId))
      .sort((left, right) => {
        const leftShortcut = shortcutById.get(left);
        const rightShortcut = shortcutById.get(right);
        if (!leftShortcut || !rightShortcut) return 0;
        return leftShortcut.name.localeCompare(rightShortcut.name);
      });

    layout[panelId] = [...persistedOrder, ...missing];
  });

  layout[UNASSIGNED_PANEL_ID] = shortcuts
    .filter((shortcut) => assignment.get(shortcut.id) === null)
    .map((shortcut) => shortcut.id)
    .sort((left, right) => {
      const leftShortcut = shortcutById.get(left);
      const rightShortcut = shortcutById.get(right);
      if (!leftShortcut || !rightShortcut) return 0;
      return leftShortcut.name.localeCompare(rightShortcut.name);
    });

  return layout;
};

const sanitizeLayout = (
  layout: Record<string, string[]>,
  draft: ShortcutShellConfig,
): { shortcutPanelMap: Record<string, string[]>; panelShortcutOrder: Record<string, string[]> } => {
  const panelIdSet = new Set(draft.panels.map((panel) => panel.id));
  const shortcutPanelMap: Record<string, string[]> = {};
  const panelShortcutOrder: Record<string, string[]> = {};

  draft.panels.forEach((panel) => {
    const orderedIds = Array.from(new Set((layout[panel.id] || []).filter(Boolean)));
    if (orderedIds.length > 0) {
      panelShortcutOrder[panel.id] = orderedIds;
      orderedIds.forEach((shortcutId) => {
        if (!shortcutPanelMap[shortcutId]) {
          shortcutPanelMap[shortcutId] = [panel.id];
        }
      });
    }
  });

  Object.entries(shortcutPanelMap).forEach(([shortcutId, panelIds]) => {
    const panelId = panelIds[0];
    if (!panelIdSet.has(panelId)) {
      delete shortcutPanelMap[shortcutId];
    }
  });

  return { shortcutPanelMap, panelShortcutOrder };
};

/**
 * Settings panel for shell-level shortcut placement and panel switching behavior.
 */
const ShortcutSettings = () => {
  const { config, shortcuts, saveConfig } = useShortcuts();
  const [draft, setDraft] = useState<ShortcutShellConfig>(config);
  const [newPanelName, setNewPanelName] = useState('');
  const [layout, setLayout] = useState<Record<string, string[]>>({ [UNASSIGNED_PANEL_ID]: [] });
  const [dragWarning, setDragWarning] = useState<string | null>(null);

  useEffect(() => {
    setDraft(config);
    setLayout(buildLayoutFromDraft(config, shortcuts));
  }, [config, shortcuts]);

  const shortcutById = useMemo(() => {
    return new Map(shortcuts.map((shortcut) => [shortcut.id, shortcut]));
  }, [shortcuts]);

  const addPanel = () => {
    const base = newPanelName.trim();
    if (!base) return;
    const existing = new Set(draft.panels.map((panel) => panel.name.toLowerCase()));
    const finalName = ensureUniquePanelName(base, existing);
    const id = `panel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setDraft((prev) => ({
      ...prev,
      panels: [...prev.panels, { id, name: finalName, order: prev.panels.length }],
    }));
    setLayout((prev) => ({ ...prev, [id]: [] }));
    setNewPanelName('');
  };

  const renamePanel = (panelId: string, name: string) => {
    setDraft((prev) => ({
      ...prev,
      panels: prev.panels.map((panel) => (panel.id === panelId ? { ...panel, name } : panel)),
    }));
  };

  const removePanel = (panelId: string) => {
    if (panelId === 'base') return;
    setDraft((prev) => {
      const nextPanels = prev.panels
        .filter((panel) => panel.id !== panelId)
        .map((panel, index) => ({ ...panel, order: index }));
      const nextBindings: ShortcutShellConfig['modifierPanelBindings'] = {};
      MODIFIER_OPTIONS.forEach(({ value }) => {
        const candidate = prev.modifierPanelBindings[value];
        if (candidate && candidate !== panelId) nextBindings[value] = candidate;
      });
      return {
        ...prev,
        panels: nextPanels,
        defaultPanelId: prev.defaultPanelId === panelId ? 'base' : prev.defaultPanelId,
        modifierPanelBindings: nextBindings,
      };
    });

    setLayout((prev) => {
      const movedToUnassigned = [...(prev[UNASSIGNED_PANEL_ID] || []), ...(prev[panelId] || [])];
      const next: Record<string, string[]> = {
        ...prev,
        [UNASSIGNED_PANEL_ID]: Array.from(new Set(movedToUnassigned)),
      };
      delete next[panelId];
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const fromContainer = findContainerForShortcut(layout, activeId);
    const toContainer = layout[overId] ? overId : findContainerForShortcut(layout, overId);

    if (!fromContainer || !toContainer) return;

    if (toContainer !== UNASSIGNED_PANEL_ID && (layout[toContainer] || []).length >= 9 && fromContainer !== toContainer) {
      setDragWarning('Cada panel admite maximo 9 atajos.');
      return;
    }

    setDragWarning(null);

    const nextLayout = moveShortcutBetweenContainers(layout, activeId, fromContainer, toContainer, overId);
    setLayout(nextLayout);

    const normalized = sanitizeLayout(nextLayout, draft);
    setDraft((prev) => ({
      ...prev,
      shortcutPanelMap: normalized.shortcutPanelMap,
      panelShortcutOrder: normalized.panelShortcutOrder,
    }));
  };

  const laneOrder = [UNASSIGNED_PANEL_ID, ...draft.panels.map((panel) => panel.id)];

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Visibilidad de superficies
        </Typography>
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2">Mostrar seccion en Inicio</Typography>
            <Switch checked={draft.showHomeSection} onChange={(_, checked) => setDraft((prev) => ({ ...prev, showHomeSection: checked }))} />
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2">Mostrar panel en sidebar</Typography>
            <Switch checked={draft.showSidebarPanel} onChange={(_, checked) => setDraft((prev) => ({ ...prev, showSidebarPanel: checked }))} />
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2">Mostrar hotbar</Typography>
            <Switch checked={draft.showHotbar} onChange={(_, checked) => setDraft((prev) => ({ ...prev, showHotbar: checked }))} />
          </Stack>
          <FormControl size="small" fullWidth>
            <InputLabel id="shortcuts-columns-label">Columnas del sidebar</InputLabel>
            <Select
              labelId="shortcuts-columns-label"
              label="Columnas del sidebar"
              value={draft.sidebarPanelColumns}
              onChange={(event) => setDraft((prev) => ({ ...prev, sidebarPanelColumns: Number(event.target.value) as 1 | 2 | 3 }))}
            >
              <MenuItem value={1}>1 columna</MenuItem>
              <MenuItem value={2}>2 columnas</MenuItem>
              <MenuItem value={3}>3 columnas</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Paneles compartidos
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Sidebar y hotbar usan los mismos paneles. Arrastra atajos entre paneles o a "Sin panel" para quitarlos.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
          <TextField
            label="Nombre de panel"
            size="small"
            value={newPanelName}
            onChange={(event) => setNewPanelName(event.target.value)}
            fullWidth
          />
          <Button variant="outlined" onClick={addPanel}>Agregar panel</Button>
        </Stack>

        <Stack spacing={1}>
          {draft.panels.map((panel) => (
            <Stack key={panel.id} direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                fullWidth
                value={panel.name}
                onChange={(event) => renamePanel(panel.id, event.target.value)}
              />
              {panel.id === draft.defaultPanelId ? <Chip label="Default" size="small" color="primary" /> : null}
              <IconButton onClick={() => removePanel(panel.id)} disabled={panel.id === 'base'} color="error">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Cambio temporal por tecla
        </Typography>

        <Stack spacing={1.25}>
          <FormControl size="small" fullWidth>
            <InputLabel id="default-panel-label">Panel default</InputLabel>
            <Select
              labelId="default-panel-label"
              label="Panel default"
              value={draft.defaultPanelId}
              onChange={(event) => setDraft((prev) => ({ ...prev, defaultPanelId: String(event.target.value) }))}
            >
              {draft.panels.map((panel) => (
                <MenuItem key={panel.id} value={panel.id}>{panel.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {MODIFIER_OPTIONS.map((modifier) => (
            <FormControl key={modifier.value} size="small" fullWidth>
              <InputLabel id={`binding-${modifier.value}`}>Panel para {modifier.label}</InputLabel>
              <Select
                labelId={`binding-${modifier.value}`}
                label={`Panel para ${modifier.label}`}
                value={draft.modifierPanelBindings[modifier.value] || ''}
                onChange={(event) => {
                  const value = String(event.target.value || '');
                  setDraft((prev) => ({
                    ...prev,
                    modifierPanelBindings: {
                      ...prev.modifierPanelBindings,
                      [modifier.value]: value || undefined,
                    },
                  }));
                }}
              >
                <MenuItem value="">Sin asignar</MenuItem>
                {draft.panels.map((panel) => (
                  <MenuItem key={panel.id} value={panel.id}>{panel.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Organizacion drag and drop
        </Typography>
        {dragWarning ? <Alert severity="warning" sx={{ mb: 1.5 }}>{dragWarning}</Alert> : null}

        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
            {laneOrder.map((laneId) => {
              const laneTitle = laneId === UNASSIGNED_PANEL_ID
                ? 'Sin panel'
                : (draft.panels.find((panel) => panel.id === laneId)?.name || laneId);
              const laneIds = layout[laneId] || [];
              return (
                <Paper key={laneId} variant="outlined" sx={{ p: 1, minHeight: 220 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 700 }}>
                    {laneTitle} ({laneIds.length}{laneId === UNASSIGNED_PANEL_ID ? '' : '/9'})
                  </Typography>
                  <DroppableLane id={laneId}>
                    <SortableContext items={laneIds} strategy={verticalListSortingStrategy}>
                      <Stack spacing={0.75}>
                        {laneIds.length === 0 ? (
                          <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">Arrastra atajos aqui</Typography>
                          </Box>
                        ) : laneIds.map((shortcutId) => {
                          const shortcut = shortcutById.get(shortcutId);
                          if (!shortcut) return null;
                          return <SortableShortcutRow key={shortcut.id} shortcut={shortcut} />;
                        })}
                      </Stack>
                    </SortableContext>
                  </DroppableLane>
                </Paper>
              );
            })}
          </Box>
        </DndContext>
      </Paper>

      <Divider />

      <Button variant="contained" onClick={() => saveConfig(draft)}>
        Guardar ajustes de atajos
      </Button>
    </Stack>
  );
};

export default ShortcutSettings;
