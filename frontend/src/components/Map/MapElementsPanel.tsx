import React from 'react';
import {
  Button,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { ElementEditorTool } from './MapElementsEditorLayer';
import type { MapElement, MapLightElement, MapDoorElement, MapWindowElement } from '../../api/mapElements';

/**
 * Props for the reusable MapElementsPanel.
 *
 * Contains all the controls to configure and interact with structural map
 * elements (walls, doors, windows, lights).
 */
export interface MapElementsPanelProps {
  elementsEditEnabled: boolean;
  onSetElementsEditEnabled: (v: boolean) => void;
  elementTool: ElementEditorTool;
  onSetElementTool: (v: ElementEditorTool) => void;
  elements: MapElement[];
  selectedElement: MapElement | null;
  onSelectElement: (el: MapElement | null) => void;
  onUpdateElement: (id: string, patch: Partial<MapElement>) => void;
  onRemoveElement: (id: string) => void;
  onClearAllElements: () => void;
  newLightRadius: number;
  onSetNewLightRadius: (v: number) => void;
  /** @deprecated Kept for backward compatibility — no longer rendered. */
  previewLights?: MapLightElement[];
  /** @deprecated Kept for backward compatibility — no longer rendered. */
  onToggleLight?: (id: string) => void;
}

/**
 * MapElementsPanel
 *
 * Shared UI panel for editing structural map elements (walls, doors, windows,
 * lights). Used in both the projection preview toolbar and the world-map
 * detail view toolbar.
 */
const MapElementsPanel: React.FC<MapElementsPanelProps> = (props) => {
  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={<Switch checked={props.elementsEditEnabled} onChange={(e) => props.onSetElementsEditEnabled(e.target.checked)} />}
        label="Editar elementos"
      />

      {props.elementsEditEnabled && (
        <>
          <TextField
            select
            size="small"
            label="Herramienta"
            value={props.elementTool}
            onChange={(e) => props.onSetElementTool(e.target.value as ElementEditorTool)}
          >
            <MenuItem value="select">Seleccionar</MenuItem>
            <MenuItem value="wall">Muro</MenuItem>
            <MenuItem value="door">Puerta</MenuItem>
            <MenuItem value="window">Ventana</MenuItem>
            <MenuItem value="light">Fuente de luz</MenuItem>
            <MenuItem value="erase">Borrar</MenuItem>
            <MenuItem value="room">Estancia</MenuItem>
          </TextField>

          {props.elementTool === 'light' && (
            <TextField
              size="small"
              type="number"
              label="Radio de luz (px)"
              value={props.newLightRadius}
              inputProps={{ min: 10, max: 2000, step: 10 }}
              onChange={(e) => props.onSetNewLightRadius(Math.max(10, Math.min(2000, Number(e.target.value || 80))))}
            />
          )}

          {/* Selected element inspector */}
          {props.selectedElement && (
            <>
              <Divider />
              <Typography variant="body2" color="text.secondary">
                Elemento seleccionado: {
                  props.selectedElement.type === 'wall' ? 'Muro' :
                  props.selectedElement.type === 'door' ? 'Puerta' :
                  props.selectedElement.type === 'window' ? 'Ventana' : 'Luz'
                }
              </Typography>

              {props.selectedElement.type === 'door' && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={(props.selectedElement as MapElement & { isOpen?: boolean }).isOpen ?? false}
                      onChange={(e) => props.onUpdateElement(props.selectedElement!.id, { isOpen: e.target.checked } as any)}
                    />
                  }
                  label="Puerta abierta"
                />
              )}

              {props.selectedElement.type === 'light' && (
                <>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={(props.selectedElement as MapLightElement).isOn}
                        onChange={(e) => props.onUpdateElement(props.selectedElement!.id, { isOn: e.target.checked } as any)}
                      />
                    }
                    label="Encendida"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={(props.selectedElement as MapLightElement).showInPreview}
                        onChange={(e) => props.onUpdateElement(props.selectedElement!.id, { showInPreview: e.target.checked } as any)}
                      />
                    }
                    label="Visible en vista previa"
                  />
                  <TextField
                    size="small"
                    label="Etiqueta"
                    value={(props.selectedElement as MapLightElement).label || ''}
                    onChange={(e) => props.onUpdateElement(props.selectedElement!.id, { label: e.target.value } as any)}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Radio (px)"
                    value={(props.selectedElement as MapLightElement).radius}
                    inputProps={{ min: 10, max: 2000, step: 10 }}
                    onChange={(e) => props.onUpdateElement(props.selectedElement!.id, { radius: Math.max(10, Number(e.target.value || 80)) } as any)}
                  />
                  <TextField
                    size="small"
                    type="color"
                    label="Color"
                    value={(props.selectedElement as MapLightElement).color || '#ffee55'}
                    onChange={(e) => props.onUpdateElement(props.selectedElement!.id, { color: e.target.value } as any)}
                  />
                  <Typography variant="caption" color="text.secondary">Intensidad por momento del día</Typography>
                  {(['dawn', 'morning', 'afternoon', 'night'] as const).map((tod) => (
                    <TextField
                      key={tod}
                      size="small"
                      type="number"
                      label={tod === 'dawn' ? 'Madrugada' : tod === 'morning' ? 'Mañana' : tod === 'afternoon' ? 'Tarde' : 'Noche'}
                      value={(props.selectedElement as MapLightElement).intensityByTimeOfDay?.[tod] ?? 1}
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                      onChange={(e) => {
                        const prev = (props.selectedElement as MapLightElement).intensityByTimeOfDay || { dawn: 1, morning: 1, afternoon: 1, night: 1 };
                        props.onUpdateElement(props.selectedElement!.id, { intensityByTimeOfDay: { ...prev, [tod]: Math.max(0, Math.min(1, Number(e.target.value || 0))) } } as any);
                      }}
                    />
                  ))}
                </>
              )}

              {props.selectedElement.type === 'window' && (
                <>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!!(props.selectedElement as MapElement & { covered?: boolean }).covered}
                        onChange={(e) => props.onUpdateElement(props.selectedElement!.id, { covered: e.target.checked } as any)}
                      />
                    }
                    label="Ventana tapada"
                  />
                  <Typography variant="caption" color="text.secondary">Luz pasante por momento del día</Typography>
                  {(['dawn', 'morning', 'afternoon', 'night'] as const).map((tod) => (
                    <TextField
                      key={tod}
                      size="small"
                      type="number"
                      label={tod === 'dawn' ? 'Madrugada' : tod === 'morning' ? 'Mañana' : tod === 'afternoon' ? 'Tarde' : 'Noche'}
                      value={(props.selectedElement as MapElement & { lightByTimeOfDay?: Record<string, number> }).lightByTimeOfDay?.[tod] ?? 0}
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                      onChange={(e) => {
                        const prev = (props.selectedElement as any).lightByTimeOfDay || { dawn: 0.3, morning: 1, afternoon: 0.7, night: 0 };
                        props.onUpdateElement(props.selectedElement!.id, { lightByTimeOfDay: { ...prev, [tod]: Math.max(0, Math.min(1, Number(e.target.value || 0))) } } as any);
                      }}
                    />
                  ))}
                </>
              )}

              <Button size="small" color="error" variant="outlined" onClick={() => { props.onRemoveElement(props.selectedElement!.id); props.onSelectElement(null); }}>
                Eliminar elemento
              </Button>
            </>
          )}

          <Divider />
          <Button size="small" variant="outlined" color="error" onClick={props.onClearAllElements}>
            Limpiar todos los elementos
          </Button>
        </>
      )}

      {/* ── Bulk actions (always visible) ─────────────────────────────── */}
      {(() => {
        const lights = props.elements.filter((el): el is MapLightElement => el.type === 'light');
        const doors = props.elements.filter((el): el is MapDoorElement => el.type === 'door');
        const windows = props.elements.filter((el): el is MapWindowElement => el.type === 'window');

        const hasLights = lights.length > 0;
        const hasDoors = doors.length > 0;
        const hasWindows = windows.length > 0;

        if (!hasLights && !hasDoors && !hasWindows) return null;

        const allLightsVisible = hasLights && lights.every((l) => l.showInPreview);
        const allLightsOn = hasLights && lights.every((l) => l.isOn);
        const allDoorsVisible = hasDoors && doors.every((d) => d.showInPreview);
        const allDoorsOpen = hasDoors && doors.every((d) => d.isOpen);
        const allWindowsVisible = hasWindows && windows.every((w) => w.showInPreview);
        const allWindowsCovered = hasWindows && windows.every((w) => w.covered);

        return (
          <>
            <Divider />
            <Typography variant="body2" color="text.secondary">Acciones masivas</Typography>

            {hasLights && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={allLightsVisible}
                      onChange={(e) => lights.forEach((l) => props.onUpdateElement(l.id, { showInPreview: e.target.checked } as any))}
                      size="small"
                    />
                  }
                  label="Luces visibles"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={allLightsOn}
                      onChange={(e) => lights.forEach((l) => props.onUpdateElement(l.id, { isOn: e.target.checked } as any))}
                      size="small"
                    />
                  }
                  label="Luces encendidas"
                />
              </>
            )}

            {hasDoors && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={allDoorsVisible}
                      onChange={(e) => doors.forEach((d) => props.onUpdateElement(d.id, { showInPreview: e.target.checked } as any))}
                      size="small"
                    />
                  }
                  label="Puertas visibles"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={allDoorsOpen}
                      onChange={(e) => doors.forEach((d) => props.onUpdateElement(d.id, { isOpen: e.target.checked } as any))}
                      size="small"
                    />
                  }
                  label="Puertas abiertas"
                />
              </>
            )}

            {hasWindows && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={allWindowsVisible}
                      onChange={(e) => windows.forEach((w) => props.onUpdateElement(w.id, { showInPreview: e.target.checked } as any))}
                      size="small"
                    />
                  }
                  label="Ventanas visibles"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={allWindowsCovered}
                      onChange={(e) => windows.forEach((w) => props.onUpdateElement(w.id, { covered: e.target.checked } as any))}
                      size="small"
                    />
                  }
                  label="Ventanas tapadas"
                />
              </>
            )}
          </>
        );
      })()}
    </Stack>
  );
};

export default MapElementsPanel;
