import { useRef, useState } from 'react';

export type SceneLayerDragState = {
  actionId: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  originLeftPct: number;
  originTopPct: number;
  originWidthPct: number;
  originHeightPct: number;
};

export type ActiveLayerDragPlacement = {
  actionId: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

/**
 * Groups refs/state used while dragging or resizing preview layers.
 */
export function useSceneLayerDrag() {
  const layerDragRef = useRef<SceneLayerDragState | null>(null);
  const [activeLayerDragPlacement, setActiveLayerDragPlacement] = useState<ActiveLayerDragPlacement | null>(null);

  return {
    layerDragRef,
    activeLayerDragPlacement,
    setActiveLayerDragPlacement,
  };
}
