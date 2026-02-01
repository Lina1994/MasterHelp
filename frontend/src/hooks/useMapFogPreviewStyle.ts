import { useCallback, useEffect, useMemo, useState } from 'react';

export type MapFogPreviewStyle = {
  color: string;
  opacity: number;
};

const DEFAULT_STYLE: MapFogPreviewStyle = {
  color: '#000000',
  opacity: 0.35,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_STYLE.opacity;
  return Math.max(0, Math.min(1, value));
}

function getKey(mapId: string): string {
  return `app.map.fogPreviewStyle.${mapId}`;
}

/**
 * useMapFogPreviewStyle
 *
 * Persists per-map fog shading style used only for the GM/master preview.
 * This does NOT affect the players window: it's a purely local visual aid.
 *
 * @param mapId Map identifier (when undefined, the hook returns defaults and does not persist).
 * @returns Current style and setters for color/opacity.
 */
export function useMapFogPreviewStyle(mapId?: string) {
  const storageKey = useMemo(() => (mapId ? getKey(mapId) : null), [mapId]);
  const [style, setStyle] = useState<MapFogPreviewStyle>(DEFAULT_STYLE);

  // Load on map change.
  useEffect(() => {
    if (!storageKey) {
      setStyle(DEFAULT_STYLE);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setStyle(DEFAULT_STYLE);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<MapFogPreviewStyle>;
      setStyle({
        color: typeof parsed.color === 'string' ? parsed.color : DEFAULT_STYLE.color,
        opacity: clamp01(Number(parsed.opacity ?? DEFAULT_STYLE.opacity)),
      });
    } catch {
      setStyle(DEFAULT_STYLE);
    }
  }, [storageKey]);

  const setColor = useCallback((color: string) => {
    setStyle((prev) => {
      const next = { ...prev, color: color || DEFAULT_STYLE.color };
      try {
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [storageKey]);

  const setOpacity = useCallback((opacity: number) => {
    setStyle((prev) => {
      const next = { ...prev, opacity: clamp01(opacity) };
      try {
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [storageKey]);

  const reset = useCallback(() => {
    setStyle(DEFAULT_STYLE);
    try {
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(DEFAULT_STYLE));
    } catch {}
  }, [storageKey]);

  return { style, setColor, setOpacity, reset };
}
