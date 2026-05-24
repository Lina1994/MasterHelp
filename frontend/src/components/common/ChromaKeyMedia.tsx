import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';

const MAX_CHROMA_LONG_EDGE_PX = 960;
const MAX_CHROMA_FPS = 60;

export interface ChromaKeySettings {
  enabled: boolean;
  color: string;
  tolerance: number;
}

interface ChromaKeyMediaProps {
  kind: 'image' | 'video';
  src: string;
  chromaKey?: Partial<ChromaKeySettings> | null;
  opacity?: number;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  pickColorEnabled?: boolean;
  onPickColor?: (hexColor: string) => void;
  onMediaError?: () => void;
  onVideoEnded?: () => void;
  isPlaying?: boolean;
  seekTimeSec?: number;
  seekVersion?: number;
  startAtSec?: number;
  loopRangeStartSec?: number;
  loopRangeEndSec?: number;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHexColor(r: number, g: number, b: number): string {
  const rr = Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0');
  const gg = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0');
  const bb = Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}

function normalizeChroma(chromaKey?: Partial<ChromaKeySettings> | null): ChromaKeySettings {
  const tolerance = Number(chromaKey?.tolerance);
  return {
    enabled: Boolean(chromaKey?.enabled),
    color: typeof chromaKey?.color === 'string' && chromaKey.color.trim() ? chromaKey.color : '#00ff00',
    tolerance: Number.isFinite(tolerance) ? Math.max(0, Math.min(100, tolerance)) : 20,
  };
}

function applyChromaKeyInPlace(
  imageData: ImageData,
  chroma: ChromaKeySettings,
): void {
  if (!chroma.enabled) return;
  const rgb = parseHexColor(chroma.color);
  if (!rgb) return;

  const { data } = imageData;
  const maxDistance = Math.sqrt(255 * 255 * 3);
  const threshold = (chroma.tolerance / 100) * maxDistance;
  const thresholdSquared = threshold * threshold;

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - rgb.r;
    const dg = data[i + 1] - rgb.g;
    const db = data[i + 2] - rgb.b;
    const distSquared = dr * dr + dg * dg + db * db;
    if (distSquared <= thresholdSquared) {
      data[i + 3] = 0;
    }
  }
}

/**
 * Renders image/video media with optional per-layer chroma key and pixel color picking.
 */
const ChromaKeyMedia: React.FC<ChromaKeyMediaProps> = ({
  kind,
  src,
  chromaKey,
  opacity = 1,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  pickColorEnabled = false,
  onPickColor,
  onMediaError,
  onVideoEnded,
  isPlaying = true,
  seekTimeSec,
  seekVersion,
  startAtSec,
  loopRangeStartSec,
  loopRangeEndSec,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const inlineVideoRef = useRef<HTMLVideoElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastDrawTimeRef = useRef<number>(0);
  const lastAppliedSeekVersionRef = useRef<number | null>(null);
  const lastStartTokenRef = useRef<string | null>(null);
  const chroma = useMemo(() => normalizeChroma(chromaKey), [chromaKey]);
  const [canvasUnavailable, setCanvasUnavailable] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState(false);

  const customLoopRange = useMemo(() => {
    const rangeStartSec = Number(loopRangeStartSec);
    const rangeEndSec = Number(loopRangeEndSec);
    const hasRangeStart = Number.isFinite(rangeStartSec) && rangeStartSec >= 0;
    const hasRangeEnd = Number.isFinite(rangeEndSec) && rangeEndSec > rangeStartSec;
    return {
      hasRangeStart,
      rangeStartSec: hasRangeStart ? rangeStartSec : undefined,
      rangeEndSec: hasRangeEnd ? rangeEndSec : undefined,
    };
  }, [loopRangeEndSec, loopRangeStartSec]);

  const nativeLoopEnabled = loop && !customLoopRange.hasRangeStart;

  const needsCanvas = !canvasUnavailable && (chroma.enabled || pickColorEnabled);

  useEffect(() => {
    setCanvasUnavailable(false);
    setMediaLoadError(false);
  }, [src, kind, chroma.enabled, pickColorEnabled]);

  useEffect(() => {
    if (kind !== 'video') return;

    const video = hiddenVideoRef.current ?? inlineVideoRef.current;
    if (!video) return;

    const hasExplicitSeekJump = seekVersion !== undefined && seekVersion !== lastAppliedSeekVersionRef.current;
    if (hasExplicitSeekJump && seekVersion !== undefined) {
      lastAppliedSeekVersionRef.current = seekVersion;
    }

    const startToken = Number.isFinite(startAtSec) ? `${src}::${Number(startAtSec).toFixed(3)}` : null;
    if (startToken && lastStartTokenRef.current !== startToken) {
      const safeStartAtSec = Math.max(0, Number(startAtSec));
      const applyStartSeek = () => {
        if (!Number.isFinite(safeStartAtSec) || video.seeking) return;
        try {
          video.currentTime = safeStartAtSec;
          lastStartTokenRef.current = startToken;
        } catch {
          // Ignore seek errors for non-seekable segments.
        }
      };

      if (video.readyState >= 1) {
        applyStartSeek();
      } else {
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          applyStartSeek();
        };
        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      }
    }

    if (Number.isFinite(seekTimeSec)) {
      let safeSeek = Math.max(0, Number(seekTimeSec));

      const rangeStartSec = Number(loopRangeStartSec);
      const rangeEndSec = Number(loopRangeEndSec);
      const hasRangeStart = Number.isFinite(rangeStartSec) && rangeStartSec >= 0;
      const effectiveRangeEndSec = Number.isFinite(rangeEndSec) && rangeEndSec > rangeStartSec
        ? rangeEndSec
        : (Number.isFinite(video.duration) && video.duration > rangeStartSec ? video.duration : null);

      if (hasRangeStart && Number.isFinite(effectiveRangeEndSec) && effectiveRangeEndSec && safeSeek >= effectiveRangeEndSec) {
        const rangeDurationSec = effectiveRangeEndSec - rangeStartSec;
        if (rangeDurationSec > 0) {
          safeSeek = rangeStartSec + ((safeSeek - rangeStartSec) % rangeDurationSec);
        } else {
          safeSeek = rangeStartSec;
        }
      }

      if (Number.isFinite(video.duration) && video.duration > 0) {
        safeSeek = Math.min(safeSeek, Math.max(0, video.duration - 0.03));
      }

      const driftSec = Math.abs(video.currentTime - safeSeek);
      const shouldSeek = hasExplicitSeekJump || (!isPlaying && driftSec > (1 / 60));
      if (shouldSeek && !video.seeking) {
        try {
          video.currentTime = safeSeek;
        } catch {
          // Ignore seek errors for non-seekable segments.
        }
      }
    }

    if (isPlaying) {
      const startPlayback = () => {
        const maybePromise = video.play();
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(() => undefined);
        }
      };

      if (video.readyState >= 2) {
        startPlayback();
      } else {
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay);
          startPlayback();
        };
        video.addEventListener('canplay', onCanPlay, { once: true });
      }
    } else {
      video.pause();
    }
  }, [kind, isPlaying, seekTimeSec, seekVersion, src, needsCanvas, startAtSec]);

  useEffect(() => {
    if (kind !== 'video') return;

    const video = hiddenVideoRef.current ?? inlineVideoRef.current;
    if (!video) return;

    const rangeStartSec = customLoopRange.rangeStartSec;
    if (!loop || rangeStartSec === undefined) return;

    const getLoopEndSec = () => {
      if (customLoopRange.rangeEndSec !== undefined) {
        const rangeEndSec = customLoopRange.rangeEndSec;
        return rangeEndSec;
      }
      if (Number.isFinite(video.duration) && video.duration > rangeStartSec) {
        return video.duration;
      }
      return null;
    };

    const onTimeUpdate = () => {
      const effectiveEndSec = getLoopEndSec();
      if (!effectiveEndSec) return;
      if (video.seeking) return;
      if (video.currentTime < effectiveEndSec - 0.03) return;
      try {
        video.currentTime = rangeStartSec;
      } catch {
        // Ignore seek errors while media is transitioning.
      }
    };

    const onEnded = () => {
      try {
        video.currentTime = rangeStartSec;
        if (isPlaying) {
          const maybePromise = video.play();
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch(() => undefined);
          }
        }
      } catch {
        // Ignore seek/play errors while media is transitioning.
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
    };
  }, [kind, loop, src, customLoopRange, isPlaying]);

  useEffect(() => {
    if (!needsCanvas || !src) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const sourceCanvas = sourceCanvasRef.current ?? document.createElement('canvas');
    sourceCanvasRef.current = sourceCanvas;

    const destCtx = canvas.getContext('2d', { willReadFrequently: true });
    const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!destCtx || !srcCtx) return;

    const markCanvasUnavailable = () => {
      setCanvasUnavailable(true);
    };

    const drawFrame = (media: CanvasImageSource, width: number, height: number) => {
      if (!canvasRef.current) return;

      if (width <= 0 || height <= 0) return;

      const longEdge = Math.max(width, height);
      const scale = longEdge > MAX_CHROMA_LONG_EDGE_PX ? (MAX_CHROMA_LONG_EDGE_PX / longEdge) : 1;
      const processWidth = Math.max(1, Math.round(width * scale));
      const processHeight = Math.max(1, Math.round(height * scale));

      if (canvas.width !== processWidth || canvas.height !== processHeight) {
        canvas.width = processWidth;
        canvas.height = processHeight;
      }
      if (sourceCanvas.width !== processWidth || sourceCanvas.height !== processHeight) {
        sourceCanvas.width = processWidth;
        sourceCanvas.height = processHeight;
      }

      srcCtx.clearRect(0, 0, processWidth, processHeight);
      srcCtx.drawImage(media, 0, 0, processWidth, processHeight);

      try {
        const frame = srcCtx.getImageData(0, 0, processWidth, processHeight);
        applyChromaKeyInPlace(frame, chroma);
        destCtx.putImageData(frame, 0, 0);
      } catch {
        markCanvasUnavailable();
      }
    };

    if (kind === 'image') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          drawFrame(img, img.naturalWidth || 1, img.naturalHeight || 1);
        } catch {
          markCanvasUnavailable();
        }
      };
      img.onerror = () => {
        markCanvasUnavailable();
        setMediaLoadError(true);
        onMediaError?.();
      };
      img.src = src;
      return;
        }

    const video = hiddenVideoRef.current;
    if (!video) return;

    const tick = (now: number) => {
      if (!hiddenVideoRef.current) return;
      const currentVideo = hiddenVideoRef.current;
      const minFrameDelta = 1000 / MAX_CHROMA_FPS;
      if (currentVideo.readyState >= 2 && now - lastDrawTimeRef.current >= minFrameDelta) {
        try {
          drawFrame(currentVideo, currentVideo.videoWidth || 1, currentVideo.videoHeight || 1);
          lastDrawTimeRef.current = now;
        } catch {
          markCanvasUnavailable();
        }
      }
      rafIdRef.current = window.requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
      lastDrawTimeRef.current = 0;
      rafIdRef.current = window.requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };

    const onLoadedData = () => startLoop();
    const onError = () => {
      markCanvasUnavailable();
      setMediaLoadError(true);
      onMediaError?.();
    };
    const onEnded = () => onVideoEnded?.();
    const drawStillFrame = () => {
      if (!hiddenVideoRef.current) return;
      const currentVideo = hiddenVideoRef.current;
      if (currentVideo.readyState < 2) return;
      try {
        drawFrame(currentVideo, currentVideo.videoWidth || 1, currentVideo.videoHeight || 1);
      } catch {
        markCanvasUnavailable();
      }
    };
    const onSeeked = () => {
      if (!video.paused) return;
      drawStillFrame();
    };
    const onLoadedMetadata = () => {
      if (!video.paused) return;
      drawStillFrame();
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', startLoop);
    video.addEventListener('pause', stopLoop);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded);

    if (!video.paused) startLoop();

    return () => {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', startLoop);
      video.removeEventListener('pause', stopLoop);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeEventListener('ended', onEnded);
      stopLoop();
    };
  }, [kind, src, chroma, needsCanvas, onMediaError, onVideoEnded]);

  const handlePickColor = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pickColorEnabled || !onPickColor) return;
    const canvas = canvasRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    if (!canvas || !sourceCanvas) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = Math.floor(((event.clientX - rect.left) / rect.width) * sourceCanvas.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * sourceCanvas.height);

    try {
      const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      onPickColor(toHexColor(pixel[0], pixel[1], pixel[2]));
    } catch {
      setCanvasUnavailable(true);
      onMediaError?.();
    }
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pickColorEnabled) return;
    event.preventDefault();
    event.stopPropagation();
  };

  if (mediaLoadError) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(8, 10, 18, 0.7)',
          color: 'rgba(255,255,255,0.86)',
          fontSize: 12,
          textAlign: 'center',
          px: 1,
          opacity,
        }}
      >
        No se pudo cargar el recurso
      </Box>
    );
  }

  if (!needsCanvas) {
    if (kind === 'image') {
      return (
        <Box
          component="img"
          src={src}
          alt="layer"
          onLoad={() => setMediaLoadError(false)}
          onError={() => {
            setMediaLoadError(true);
            onMediaError?.();
          }}
          sx={{ width: '100%', height: '100%', objectFit: 'contain', opacity }}
        />
      );
    }

    return (
      <video
        ref={inlineVideoRef}
        src={src}
        preload="auto"
        autoPlay={autoPlay}
        loop={nativeLoopEnabled}
        muted={muted}
        playsInline={playsInline}
        controls={false}
        onLoadedData={() => setMediaLoadError(false)}
        onError={() => {
          setMediaLoadError(true);
          onMediaError?.();
        }}
        onEnded={onVideoEnded}
        style={{ width: '100%', height: '100%', objectFit: 'contain', opacity }}
      />
    );
  }

  return (
    <>
      {kind === 'video' ? (
        <video
          ref={hiddenVideoRef}
          src={src}
          preload="auto"
          autoPlay={autoPlay}
          loop={nativeLoopEnabled}
          muted={muted}
          playsInline={playsInline}
          crossOrigin="anonymous"
          style={{ display: 'none' }}
        />
      ) : null}
      <Box
        component="canvas"
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onClick={handlePickColor}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          opacity,
          cursor: pickColorEnabled ? 'crosshair' : 'default',
        }}
      />
    </>
  );
};

export default ChromaKeyMedia;
