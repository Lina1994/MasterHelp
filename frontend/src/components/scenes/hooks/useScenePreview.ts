import { useRef, useState } from 'react';
import type { WindowSize } from '../../../hooks/useSecondaryWindowSizes';
import type { ScenePreviewWindowKind } from '../utils/sceneLayerUtils';

/**
 * Groups preview playback and viewport state for SceneFormDialog.
 */
export function useScenePreview(memoryWarmupStorageKey: string) {
  const [previewWindowKind, setPreviewWindowKind] = useState<ScenePreviewWindowKind>('projection');
  const [previewZoom, setPreviewZoom] = useState<number>(0.25);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [isPreviewLooping, setIsPreviewLooping] = useState<boolean>(true);
  const [previewLoopMode, setPreviewLoopMode] = useState<'full' | 'partial'>('full');
  const [currentTimelineTimeMs, setCurrentTimelineTimeMs] = useState<number>(0);
  const [previewSeekVersion, setPreviewSeekVersion] = useState<number>(0);
  const [previewLoopCycleIndex, setPreviewLoopCycleIndex] = useState<number>(0);
  const [projectionWindowSize, setProjectionWindowSize] = useState<WindowSize | null>(null);
  const [skylineWindowSize, setSkylineWindowSize] = useState<WindowSize | null>(null);
  const [isPreviewMemoryWarmupEnabled, setIsPreviewMemoryWarmupEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(memoryWarmupStorageKey) !== 'off';
    } catch {
      return true;
    }
  });
  const previewStageRef = useRef<HTMLDivElement | null>(null);

  return {
    previewWindowKind,
    setPreviewWindowKind,
    previewZoom,
    setPreviewZoom,
    isPreviewPlaying,
    setIsPreviewPlaying,
    isPreviewLooping,
    setIsPreviewLooping,
    previewLoopMode,
    setPreviewLoopMode,
    currentTimelineTimeMs,
    setCurrentTimelineTimeMs,
    previewSeekVersion,
    setPreviewSeekVersion,
    previewLoopCycleIndex,
    setPreviewLoopCycleIndex,
    projectionWindowSize,
    setProjectionWindowSize,
    skylineWindowSize,
    setSkylineWindowSize,
    isPreviewMemoryWarmupEnabled,
    setIsPreviewMemoryWarmupEnabled,
    previewStageRef,
  };
}
