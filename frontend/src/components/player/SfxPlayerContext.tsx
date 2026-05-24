import React, { createContext, useContext, useMemo, useRef, useState, ReactNode } from 'react';

export type SfxLoopMode = 'once' | 'continuous' | 'fixed' | 'random';

export interface SfxPlayOptions {
  volume?: number; // 0..1
  startAtSec?: number; // start playback offset in seconds
  durationMs?: number; // max playback duration in ms
  clipOutSec?: number; // optional absolute end offset in seconds (relative to original source)
  playbackRate?: number; // 0.25..4
  loopMode?: SfxLoopMode;
  waitMs?: number; // for fixed
  randomMinMs?: number; // for random
  randomMaxMs?: number; // for random
  uniquePerEffect?: boolean; // if true, stop existing instances of same effectId before playing
  // Callbacks
  onEnded?: (instanceId: string) => void; // called when audio ends
  // Modifiers
  echoEnabled?: boolean;
  echoDelayMs?: number;
  echoFeedback?: number; // 0..1
  pitchSemitones?: number; // negative lower, positive higher
  filterType?: 'none' | 'lowpass' | 'highpass' | 'bandpass';
  filterFrequency?: number;
  filterQ?: number;
}

export interface SfxListItem {
  instanceId: string;
  effectId: string;
  name: string;
  volume: number;
  loopMode: SfxLoopMode;
  waiting: boolean; // true when in the waiting window between plays (fixed/random)
}

interface Controller {
  audio: HTMLAudioElement;
  objectUrl: string;
  loopMode: SfxLoopMode;
  waitMs?: number;
  randomMinMs?: number;
  randomMaxMs?: number;
  endedHandler?: () => void;
  pendingTimer?: number | null;
  isWaiting: boolean;
  ctx?: AudioContext;
  sourceNode?: MediaElementAudioSourceNode;
  gainNode?: GainNode;
  filterNode?: BiquadFilterNode;
  delayNode?: DelayNode;
  feedbackGain?: GainNode;
  durationTimer?: number | null;
}

interface SfxPlayerContextType {
  items: SfxListItem[];
  playSfx: (
    meta: { effectId: string; name: string },
    loader: () => Promise<string>,
    options?: SfxPlayOptions,
  ) => Promise<string>; // returns instanceId
  stopSfx: (instanceId: string) => void;
  stopAllSfx: () => void;
  setSfxVolume: (instanceId: string, volume: number) => void;
}

const SfxPlayerContext = createContext<SfxPlayerContextType | undefined>(undefined);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * SfxPlayerProvider gestiona reproducción concurrente de efectos de sonido.
 * - Cada efecto activa su propio elemento Audio con su propio bucle y volumen.
 * - Soporta modos de bucle: once, continuous (loop nativo), fixed (espera fija) y random (espera aleatoria).
 * - Expone controles para listar, parar y ajustar volumen por instancia.
 */
export const SfxPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const ctrlsRef = useRef<Map<string, Controller>>(new Map());
  const [version, setVersion] = useState(0); // para forzar re-render al cambiar items

  const listItems = useMemo<SfxListItem[]>(() => {
    return Array.from(ctrlsRef.current.entries()).map(([instanceId, c]) => ({
      instanceId,
      effectId: (c.audio as any).__effectId as string,
      name: (c.audio as any).__name as string,
      volume: c.audio.volume,
      loopMode: c.loopMode,
      waiting: !!c.isWaiting,
    }));
  }, [version]);

  const destroyController = (instanceId: string) => {
    const c = ctrlsRef.current.get(instanceId);
    if (!c) return;
    if (c.endedHandler) {
      c.audio.removeEventListener('ended', c.endedHandler);
    }
    if (c.pendingTimer) {
      window.clearTimeout(c.pendingTimer);
    }
    if (c.durationTimer) {
      window.clearTimeout(c.durationTimer);
    }
    c.audio.pause();
    // teardown Web Audio graph
    try { if (c.sourceNode) c.sourceNode.disconnect(); } catch {}
    try { if (c.gainNode) c.gainNode.disconnect(); } catch {}
    try { if (c.filterNode) c.filterNode.disconnect(); } catch {}
    try { if (c.delayNode) c.delayNode.disconnect(); } catch {}
    try { if (c.feedbackGain) c.feedbackGain.disconnect(); } catch {}
    try { if (c.ctx) c.ctx.close(); } catch {}
    // revoke and clear
    try { URL.revokeObjectURL(c.objectUrl); } catch {}
    c.audio.src = '';
    ctrlsRef.current.delete(instanceId);
  };

  const scheduleNext = (instanceId: string, controller: Controller) => {
    // For fixed/random modes, schedule next play after ended
    if (controller.pendingTimer) {
      window.clearTimeout(controller.pendingTimer);
      controller.pendingTimer = null;
    }
    if (controller.loopMode === 'fixed') {
      const wait = Math.max(0, controller.waitMs ?? 0);
      // eslint-disable-next-line no-console
      console.debug('[SFX] ended -> fixed wait', { instanceId, wait });
      controller.isWaiting = true;
      setVersion(v => v + 1);
      controller.pendingTimer = window.setTimeout(() => {
        controller.audio.currentTime = 0;
        controller.isWaiting = false;
        setVersion(v => v + 1);
        controller.audio.play().catch(() => {});
      }, wait);
    } else if (controller.loopMode === 'random') {
      const min = Math.max(0, controller.randomMinMs ?? 0);
      const max = Math.max(min, controller.randomMaxMs ?? min);
      const wait = Math.floor(min + Math.random() * (max - min));
      // eslint-disable-next-line no-console
      console.debug('[SFX] ended -> random wait', { instanceId, min, max, wait });
      controller.isWaiting = true;
      setVersion(v => v + 1);
      controller.pendingTimer = window.setTimeout(() => {
        controller.audio.currentTime = 0;
        controller.isWaiting = false;
        setVersion(v => v + 1);
        controller.audio.play().catch(() => {});
      }, wait);
    }
  };

  const playSfx: SfxPlayerContextType['playSfx'] = async (meta, loader, options) => {
    // If requested, ensure there's only one instance per effect
    if (options?.uniquePerEffect) {
      Array.from(ctrlsRef.current.entries()).forEach(([id, c]) => {
        const eff = (c.audio as any).__effectId as string;
        if (eff === meta.effectId) {
          destroyController(id);
        }
      });
      setVersion(v => v + 1);
    }
    const url = await loader();
  const audio = new Audio(url);
    const instanceId = `${meta.effectId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const loopMode = options?.loopMode ?? 'once';
    audio.volume = clamp01(options?.volume ?? 1);
    (audio as any).__effectId = meta.effectId;
    (audio as any).__name = meta.name;
    const controller: Controller = {
      audio,
      objectUrl: url,
      loopMode,
      waitMs: options?.waitMs,
      randomMinMs: options?.randomMinMs,
      randomMaxMs: options?.randomMaxMs,
      pendingTimer: null,
      durationTimer: null,
      isWaiting: false,
    };

    const startAtSec = Number.isFinite(Number(options?.startAtSec)) && Number(options?.startAtSec) >= 0
      ? Number(options?.startAtSec)
      : 0;
    const clipOutSec = Number.isFinite(Number(options?.clipOutSec)) && Number(options?.clipOutSec) > startAtSec
      ? Number(options?.clipOutSec)
      : undefined;
    const requestedDurationMs = Number.isFinite(Number(options?.durationMs)) && Number(options?.durationMs) > 0
      ? Math.round(Number(options?.durationMs))
      : undefined;
    const clipWindowDurationMs = clipOutSec !== undefined
      ? Math.max(0, Math.round((clipOutSec - startAtSec) * 1000))
      : undefined;
    const effectiveDurationMs =
      requestedDurationMs !== undefined && clipWindowDurationMs !== undefined
        ? Math.min(requestedDurationMs, clipWindowDurationMs)
        : (requestedDurationMs ?? clipWindowDurationMs);

    // Web Audio modifiers
    if (options?.playbackRate !== undefined && Number.isFinite(Number(options.playbackRate))) {
      audio.playbackRate = Math.max(0.25, Math.min(4, Number(options.playbackRate)));
    }

    if (
      options?.echoEnabled
      || (options?.pitchSemitones && options.pitchSemitones !== 0)
      || (options?.filterType && options.filterType !== 'none')
    ) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 1;
        let lastNode: AudioNode = source;
        // pitch via playbackRate (approx), compounded over explicit playbackRate if provided
        if (options?.pitchSemitones && options.pitchSemitones !== 0) {
          const ratio = Math.pow(2, (options.pitchSemitones as number) / 12);
          audio.playbackRate = audio.playbackRate * ratio;
        }
        // optional frequency filter
        if (options?.filterType && options.filterType !== 'none') {
          const filter = ctx.createBiquadFilter();
          filter.type = options.filterType;
          filter.frequency.value = Math.max(20, Math.min(20000, Number(options.filterFrequency ?? 1000)));
          filter.Q.value = Math.max(0.1, Math.min(30, Number(options.filterQ ?? 1)));
          lastNode.connect(filter);
          lastNode = filter;
          controller.filterNode = filter;
        }
        // echo via delay + feedback loop
        if (options?.echoEnabled) {
          const delay = ctx.createDelay(5.0);
          delay.delayTime.value = Math.max(0, (options.echoDelayMs ?? 300) / 1000);
          const feedback = ctx.createGain();
          feedback.gain.value = clamp01(options.echoFeedback ?? 0.3);
          lastNode.connect(delay);
          delay.connect(feedback);
          feedback.connect(delay);
          lastNode = delay;
          controller.delayNode = delay;
          controller.feedbackGain = feedback;
        }
        lastNode.connect(gain);
        gain.connect(ctx.destination);
        controller.ctx = ctx;
        controller.sourceNode = source;
        controller.gainNode = gain;
      } catch {}
    }
    if (loopMode === 'continuous') {
      audio.loop = true;
    } else {
      audio.loop = false;
      controller.endedHandler = () => {
        // Call optional onEnded callback
        options?.onEnded?.(instanceId);
        
        if (controller.loopMode === 'once') {
          // remove from sidebar after one-shot ends
          destroyController(instanceId);
          setVersion(v => v + 1);
        } else {
          scheduleNext(instanceId, controller);
        }
      };
      audio.addEventListener('ended', controller.endedHandler);
    }
    if (startAtSec > 0) {
      const applyStartOffset = () => {
        try {
          audio.currentTime = startAtSec;
        } catch {
          // Ignore seek failures for sources that cannot seek immediately.
        }
      };
      if (audio.readyState >= 1) {
        applyStartOffset();
      } else {
        audio.addEventListener('loadedmetadata', applyStartOffset, { once: true });
      }
    }

    if (effectiveDurationMs !== undefined && effectiveDurationMs > 0) {
      const scheduleDurationStop = () => {
        if (controller.durationTimer) {
          window.clearTimeout(controller.durationTimer);
        }
        controller.durationTimer = window.setTimeout(() => {
          destroyController(instanceId);
          setVersion(v => v + 1);
        }, Math.max(1, effectiveDurationMs));
      };
      if (audio.readyState >= 2) {
        scheduleDurationStop();
      } else {
        audio.addEventListener('playing', scheduleDurationStop, { once: true });
      }
    }
    // eslint-disable-next-line no-console
    console.debug('[SFX] play', { instanceId, effectId: meta.effectId, name: meta.name, loopMode, audioLoop: audio.loop, waitMs: controller.waitMs, randomMinMs: controller.randomMinMs, randomMaxMs: controller.randomMaxMs });
    ctrlsRef.current.set(instanceId, controller);
    setVersion(v => v + 1);
    audio.play().catch(() => {});
    return instanceId;
  };

  const stopSfx: SfxPlayerContextType['stopSfx'] = (instanceId) => {
    destroyController(instanceId);
    setVersion(v => v + 1);
  };

  const stopAllSfx: SfxPlayerContextType['stopAllSfx'] = () => {
    Array.from(ctrlsRef.current.keys()).forEach(k => destroyController(k));
    setVersion(v => v + 1);
  };

  const setSfxVolume: SfxPlayerContextType['setSfxVolume'] = (instanceId, volume) => {
    const c = ctrlsRef.current.get(instanceId);
    if (!c) return;
    c.audio.volume = clamp01(volume);
    setVersion(v => v + 1);
  };

  const value: SfxPlayerContextType = useMemo(() => ({
    items: listItems,
    playSfx,
    stopSfx,
    stopAllSfx,
    setSfxVolume,
  }), [listItems]);

  return (
    <SfxPlayerContext.Provider value={value}>{children}</SfxPlayerContext.Provider>
  );
};

export const useSfxPlayer = () => {
  const ctx = useContext(SfxPlayerContext);
  if (!ctx) throw new Error('useSfxPlayer must be used within SfxPlayerProvider');
  return ctx;
};
