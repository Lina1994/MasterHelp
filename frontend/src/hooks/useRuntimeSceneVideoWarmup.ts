import { useCallback, useEffect, useMemo, useRef } from 'react';

const DEFAULT_MAX_ITEMS = 2;
const DEFAULT_MAX_TOTAL_BYTES = 180 * 1024 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const DEFAULT_RANGE_BYTES = 512 * 1024;

interface SourceEntry {
  status: 'loading' | 'ready' | 'error';
  objectUrl?: string;
  sizeBytes?: number;
  lastUsedAtMs: number;
  abortController?: AbortController;
}

interface RuntimeVideoWarmupOptions {
  enabled?: boolean;
  maxItems?: number;
  maxTotalBytes?: number;
  fetchTimeoutMs?: number;
  rangeBytes?: number;
}

export interface RuntimeVideoWarmupResult {
  preloadVideoForOverlay: (overlayKey: string, sourceUrl: string) => void;
  resolveVideoSrc: (overlayKey: string, fallbackUrl: string) => string;
  releaseOverlayVideo: (overlayKey: string) => void;
  clearWarmupCache: () => void;
}

function nowMs(): number {
  return Date.now();
}

function buildTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
    return (AbortSignal as any).timeout(timeoutMs) as AbortSignal;
  }
  return undefined;
}

/**
 * Keeps a bounded in-memory cache of runtime scene videos using blob URLs.
 *
 * The warmup is opportunistic and never blocks command scheduling. If a video is
 * not ready when playback starts, callers should keep using the original URL.
 */
export function useRuntimeSceneVideoWarmup(options?: RuntimeVideoWarmupOptions): RuntimeVideoWarmupResult {
  const {
    enabled = true,
    maxItems = DEFAULT_MAX_ITEMS,
    maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
    fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    rangeBytes = DEFAULT_RANGE_BYTES,
  } = options ?? {};

  const sourceEntriesRef = useRef<Map<string, SourceEntry>>(new Map());
  const overlaySourceRef = useRef<Map<string, string>>(new Map());
  const totalBytesRef = useRef<number>(0);

  const evictSource = useCallback((sourceUrl: string) => {
    const entry = sourceEntriesRef.current.get(sourceUrl);
    if (!entry) return;
    entry.abortController?.abort();
    if (entry.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
    }
    if (entry.sizeBytes) {
      totalBytesRef.current = Math.max(0, totalBytesRef.current - entry.sizeBytes);
    }
    sourceEntriesRef.current.delete(sourceUrl);
  }, []);

  const clearWarmupCache = useCallback(() => {
    sourceEntriesRef.current.forEach((entry, sourceUrl) => {
      entry.abortController?.abort();
      if (entry.objectUrl) {
        URL.revokeObjectURL(entry.objectUrl);
      }
      sourceEntriesRef.current.delete(sourceUrl);
    });
    overlaySourceRef.current.clear();
    totalBytesRef.current = 0;
  }, []);

  const releaseOverlayVideo = useCallback((overlayKey: string) => {
    overlaySourceRef.current.delete(overlayKey);
  }, []);

  const pickEvictionCandidate = useCallback((): string | null => {
    let candidateUrl: string | null = null;
    let candidateLastUsed = Number.POSITIVE_INFINITY;
    const referencedUrls = new Set(Array.from(overlaySourceRef.current.values()));

    sourceEntriesRef.current.forEach((entry, sourceUrl) => {
      if (entry.status !== 'ready' || referencedUrls.has(sourceUrl)) {
        return;
      }
      if (entry.lastUsedAtMs < candidateLastUsed) {
        candidateLastUsed = entry.lastUsedAtMs;
        candidateUrl = sourceUrl;
      }
    });

    if (candidateUrl) return candidateUrl;

    sourceEntriesRef.current.forEach((entry, sourceUrl) => {
      if (entry.status !== 'ready') return;
      if (entry.lastUsedAtMs < candidateLastUsed) {
        candidateLastUsed = entry.lastUsedAtMs;
        candidateUrl = sourceUrl;
      }
    });

    return candidateUrl;
  }, []);

  const enforceBounds = useCallback((incomingSizeBytes = 0): boolean => {
    while (
      (sourceEntriesRef.current.size >= maxItems || totalBytesRef.current + incomingSizeBytes > maxTotalBytes)
      && sourceEntriesRef.current.size > 0
    ) {
      const candidate = pickEvictionCandidate();
      if (!candidate) break;
      evictSource(candidate);
    }

    return sourceEntriesRef.current.size < maxItems && totalBytesRef.current + incomingSizeBytes <= maxTotalBytes;
  }, [evictSource, maxItems, maxTotalBytes, pickEvictionCandidate]);

  const primeHttpCache = useCallback(async (sourceUrl: string) => {
    const timeoutSignal = buildTimeoutSignal(Math.max(2000, Math.min(5000, fetchTimeoutMs)));
    try {
      await fetch(sourceUrl, {
        method: 'GET',
        headers: { Range: `bytes=0-${Math.max(1024, rangeBytes) - 1}` },
        cache: 'force-cache',
        signal: timeoutSignal,
      });
    } catch {
      // Keep this best-effort only.
    }
  }, [fetchTimeoutMs, rangeBytes]);

  const preloadVideoForOverlay = useCallback((overlayKey: string, sourceUrl: string) => {
    if (!enabled || !sourceUrl) return;

    overlaySourceRef.current.set(overlayKey, sourceUrl);

    const existing = sourceEntriesRef.current.get(sourceUrl);
    if (existing?.status === 'ready') {
      existing.lastUsedAtMs = nowMs();
      return;
    }
    if (existing?.status === 'loading') {
      existing.lastUsedAtMs = nowMs();
      return;
    }

    if (!enforceBounds()) {
      void primeHttpCache(sourceUrl);
      return;
    }

    const abortController = new AbortController();
    const timeoutSignal = buildTimeoutSignal(fetchTimeoutMs);
    const loadSignal = timeoutSignal ?? abortController.signal;

    sourceEntriesRef.current.set(sourceUrl, {
      status: 'loading',
      abortController,
      lastUsedAtMs: nowMs(),
    });

    void (async () => {
      try {
        const response = await fetch(sourceUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: loadSignal,
        });

        if (!response.ok) {
          throw new Error(`Warmup failed: ${response.status}`);
        }

        const blob = await response.blob();
        if (!blob.size) {
          throw new Error('Warmup blob is empty');
        }

        if (!enforceBounds(blob.size)) {
          sourceEntriesRef.current.set(sourceUrl, {
            status: 'error',
            lastUsedAtMs: nowMs(),
          });
          void primeHttpCache(sourceUrl);
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        totalBytesRef.current += blob.size;
        sourceEntriesRef.current.set(sourceUrl, {
          status: 'ready',
          objectUrl,
          sizeBytes: blob.size,
          lastUsedAtMs: nowMs(),
        });
      } catch {
        sourceEntriesRef.current.set(sourceUrl, {
          status: 'error',
          lastUsedAtMs: nowMs(),
        });
      }
    })();
  }, [enabled, enforceBounds, fetchTimeoutMs, primeHttpCache]);

  const resolveVideoSrc = useCallback((overlayKey: string, fallbackUrl: string): string => {
    if (!enabled) return fallbackUrl;
    const sourceUrl = overlaySourceRef.current.get(overlayKey) || fallbackUrl;
    const entry = sourceEntriesRef.current.get(sourceUrl);
    if (entry?.status === 'ready' && entry.objectUrl) {
      entry.lastUsedAtMs = nowMs();
      return entry.objectUrl;
    }
    return fallbackUrl;
  }, [enabled]);

  useEffect(() => {
    if (enabled) return;
    clearWarmupCache();
  }, [clearWarmupCache, enabled]);

  useEffect(() => {
    return () => {
      clearWarmupCache();
    };
  }, [clearWarmupCache]);

  return useMemo(() => ({
    preloadVideoForOverlay,
    resolveVideoSrc,
    releaseOverlayVideo,
    clearWarmupCache,
  }), [clearWarmupCache, preloadVideoForOverlay, releaseOverlayVideo, resolveVideoSrc]);
}

export default useRuntimeSceneVideoWarmup;
