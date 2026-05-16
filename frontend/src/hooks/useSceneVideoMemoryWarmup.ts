import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_MAX_ITEMS = 4;
const DEFAULT_MAX_TOTAL_BYTES = 300 * 1024 * 1024;

interface WarmupSourceEntry {
  status: 'loading' | 'ready' | 'error';
  objectUrl?: string;
  sizeBytes?: number;
  abortController?: AbortController;
}

export interface UseSceneVideoMemoryWarmupOptions {
  open: boolean;
  enabled: boolean;
  urlsByActionId: Record<string, string>;
  prioritizedActionIds?: string[];
  maxItems?: number;
  maxTotalBytes?: number;
}

export interface SceneVideoMemoryWarmupResult {
  resolvedUrlsByActionId: Record<string, string>;
  warmedActionCount: number;
  targetedActionCount: number;
}

/**
 * Keeps a bounded set of scene preview videos decoded from in-memory blob URLs.
 *
 * This hook is intended for editor preview usage only. When enabled, it fetches a
 * capped subset of video URLs, stores them as blob object URLs, and swaps the
 * preview source to those object URLs so replay does not rely on repeated network
 * reads. Resources are released when the editor closes or when warmup is disabled.
 */
export function useSceneVideoMemoryWarmup(
  options: UseSceneVideoMemoryWarmupOptions,
): SceneVideoMemoryWarmupResult {
  const {
    open,
    enabled,
    urlsByActionId,
    prioritizedActionIds = [],
    maxItems = DEFAULT_MAX_ITEMS,
    maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
  } = options;

  const [resolvedUrlsByActionId, setResolvedUrlsByActionId] = useState<Record<string, string>>(urlsByActionId);
  const [warmedActionCount, setWarmedActionCount] = useState<number>(0);
  const [targetedActionCount, setTargetedActionCount] = useState<number>(0);

  const sourceEntriesRef = useRef<Map<string, WarmupSourceEntry>>(new Map());
  const totalBytesRef = useRef<number>(0);

  const priorityRank = useMemo(() => {
    const rank = new Map<string, number>();
    prioritizedActionIds.forEach((actionId, index) => {
      if (!rank.has(actionId)) rank.set(actionId, index);
    });
    return rank;
  }, [prioritizedActionIds]);

  const clearAllSources = () => {
    sourceEntriesRef.current.forEach((entry) => {
      entry.abortController?.abort();
      if (entry.objectUrl) {
        URL.revokeObjectURL(entry.objectUrl);
      }
    });
    sourceEntriesRef.current.clear();
    totalBytesRef.current = 0;
  };

  useEffect(() => {
    return () => {
      clearAllSources();
    };
  }, []);

  useEffect(() => {
    if (!open || !enabled) {
      clearAllSources();
      setResolvedUrlsByActionId(urlsByActionId);
      setWarmedActionCount(0);
      setTargetedActionCount(0);
      return;
    }

    let disposed = false;
    const entries = Object.entries(urlsByActionId)
      .filter(([, url]) => Boolean(url))
      .sort(([actionIdA], [actionIdB]) => {
        const rankA = priorityRank.get(actionIdA);
        const rankB = priorityRank.get(actionIdB);
        if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
        if (rankA !== undefined) return -1;
        if (rankB !== undefined) return 1;
        return actionIdA.localeCompare(actionIdB);
      });

    const cappedEntries = entries.slice(0, Math.max(1, maxItems));
    const targetSources = new Set(cappedEntries.map(([, sourceUrl]) => sourceUrl));

    sourceEntriesRef.current.forEach((entry, sourceUrl) => {
      if (targetSources.has(sourceUrl)) return;
      entry.abortController?.abort();
      if (entry.objectUrl) {
        URL.revokeObjectURL(entry.objectUrl);
      }
      if (entry.sizeBytes) {
        totalBytesRef.current = Math.max(0, totalBytesRef.current - entry.sizeBytes);
      }
      sourceEntriesRef.current.delete(sourceUrl);
    });

    const updateResolvedState = () => {
      if (disposed) return;

      let warmedCount = 0;
      const nextResolved: Record<string, string> = {};
      for (const [actionId, sourceUrl] of entries) {
        const sourceEntry = sourceEntriesRef.current.get(sourceUrl);
        if (sourceEntry?.status === 'ready' && sourceEntry.objectUrl) {
          nextResolved[actionId] = sourceEntry.objectUrl;
          warmedCount += 1;
        } else {
          nextResolved[actionId] = sourceUrl;
        }
      }

      setResolvedUrlsByActionId(nextResolved);
      setWarmedActionCount(warmedCount);
      setTargetedActionCount(cappedEntries.length);
    };

    const loadSource = async (sourceUrl: string): Promise<void> => {
      const existing = sourceEntriesRef.current.get(sourceUrl);
      if (existing?.status === 'ready' || existing?.status === 'loading') {
        return;
      }

      if (totalBytesRef.current >= maxTotalBytes) {
        sourceEntriesRef.current.set(sourceUrl, { status: 'error' });
        return;
      }

      const abortController = new AbortController();
      sourceEntriesRef.current.set(sourceUrl, { status: 'loading', abortController });
      updateResolvedState();

      try {
        const response = await fetch(sourceUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Video preload failed: ${response.status}`);
        }

        const blob = await response.blob();
        if (!blob.size || totalBytesRef.current + blob.size > maxTotalBytes) {
          sourceEntriesRef.current.set(sourceUrl, { status: 'error' });
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        totalBytesRef.current += blob.size;
        sourceEntriesRef.current.set(sourceUrl, {
          status: 'ready',
          objectUrl,
          sizeBytes: blob.size,
        });
      } catch {
        if (!abortController.signal.aborted) {
          sourceEntriesRef.current.set(sourceUrl, { status: 'error' });
        }
      } finally {
        updateResolvedState();
      }
    };

    const runWarmup = async () => {
      for (const [, sourceUrl] of cappedEntries) {
        if (disposed) return;
        await loadSource(sourceUrl);
      }
    };

    updateResolvedState();
    runWarmup();

    return () => {
      disposed = true;
    };
  }, [enabled, maxItems, maxTotalBytes, open, priorityRank, urlsByActionId]);

  return {
    resolvedUrlsByActionId,
    warmedActionCount,
    targetedActionCount,
  };
}

export default useSceneVideoMemoryWarmup;
