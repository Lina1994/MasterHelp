import type { NarratorPlaybackHandle, NarratorVoiceConfig } from '../narratorPlayback';
import {
  resolveTomodachiSampleId,
  resolveTomodachiSamplePathForSet,
  type TomodachiSampleId,
  type TomodachiSampleSet,
} from './tomodachiPhonemeMap';

type PlayTomodachiNarrationOptions = {
  text: string;
  voiceConfig: NarratorVoiceConfig;
  locale?: string;
};

type TomodachiToken =
  | { kind: 'sample'; sampleId: TomodachiSampleId; durationMs: number; detuneCents: number }
  | { kind: 'pause'; durationMs: number };

const AUDIO_START_DELAY_MS = 18;
const VOWEL_DURATION_MS = 84;
const CONSONANT_DURATION_MS = 62;
const SPACE_PAUSE_MS = 68;
const PUNCTUATION_PAUSE_MS: Record<string, number> = {
  ',': 130,
  ';': 145,
  ':': 155,
  '.': 215,
  '!': 205,
  '?': 215,
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeText = (text: string): string => String(text ?? '').replace(/\s+/g, ' ').trim();

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededRandom = (seed: number): (() => number) => {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
};

const isSpeechChar = (char: string): boolean => /[\p{L}\p{N}]/u.test(char);

const isVowelLike = (char: string): boolean => {
  return ['a', 'e', 'i', 'o', 'u', 'y', '\u00e1', '\u00e9', '\u00ed', '\u00f3', '\u00fa', '\u00fc'].includes(char.toLowerCase());
};

const getAudioContext = (): AudioContext => {
  const anyWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const contextCtor = window.AudioContext ?? anyWindow.webkitAudioContext;
  if (!contextCtor) {
    throw new Error('AudioContext not supported in this environment.');
  }
  return new contextCtor();
};

/**
 * Runtime engine that renders tomodachi narration using short pre-recorded samples.
 */
class TomodachiSampleEngine {
  private readonly bufferCache = new Map<string, AudioBuffer>();
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = getAudioContext();
    }
    return this.audioContext;
  }

  private async getSampleBuffer(sampleId: TomodachiSampleId, sampleSet: TomodachiSampleSet): Promise<AudioBuffer> {
    const cacheKey = `${sampleSet}:${sampleId}`;
    const cached = this.bufferCache.get(cacheKey);
    if (cached) return cached;

    const context = this.getContext();
    const candidatePaths: string[] = [resolveTomodachiSamplePathForSet(sampleId, sampleSet)];
    if (sampleSet !== 'classic') {
      candidatePaths.push(resolveTomodachiSamplePathForSet(sampleId, 'classic'));
    }

    let response: Response | null = null;
    for (const path of candidatePaths) {
      const current = await fetch(path);
      if (current.ok) {
        response = current;
        break;
      }
    }
    if (!response) {
      throw new Error(`Unable to load tomodachi sample: ${sampleId}`);
    }
    const rawBuffer = await response.arrayBuffer();
    const decoded = await context.decodeAudioData(rawBuffer.slice(0));
    this.bufferCache.set(cacheKey, decoded);
    return decoded;
  }

  private buildTokens(text: string, voiceConfig: NarratorVoiceConfig, locale?: string): TomodachiToken[] {
    const normalized = normalizeText(text);
    if (!normalized) return [];
    const tokens: TomodachiToken[] = [];
    const seed = hashString(`${normalized}|${voiceConfig.speed}|${voiceConfig.pitchRange}|${String(locale ?? '').toLowerCase()}`);
    const random = seededRandom(seed);
    const humanize = clamp(voiceConfig.tomodachi.humanize, 0, 1);
    const consonantDensity = clamp(voiceConfig.tomodachi.consonantDensity, 0, 1);

    for (const char of normalized) {
      if (char === ' ') {
        tokens.push({ kind: 'pause', durationMs: SPACE_PAUSE_MS / voiceConfig.speed });
        continue;
      }

      const punctuationPause = PUNCTUATION_PAUSE_MS[char];
      if (punctuationPause !== undefined) {
        tokens.push({ kind: 'pause', durationMs: punctuationPause / voiceConfig.speed });
        continue;
      }

      if (!isSpeechChar(char)) {
        continue;
      }

      if (!isVowelLike(char) && consonantDensity < 1 && random() > consonantDensity) {
        continue;
      }

      const sampleId = resolveTomodachiSampleId(char);
      const baseDurationMs = isVowelLike(char) ? VOWEL_DURATION_MS : CONSONANT_DURATION_MS;
      const durationJitter = (random() * 2 - 1) * (2 + (8 * humanize));
      const durationMs = clamp((baseDurationMs + durationJitter) / voiceConfig.speed, 18, 220);
      const detuneJitter = (random() * 2 - 1) * voiceConfig.pitchRange * (2.5 + (10 * humanize));
      const detuneCents = clamp(detuneJitter, -240, 240);

      tokens.push({ kind: 'sample', sampleId, durationMs, detuneCents });
    }

    const trimmed = normalized.trimEnd();
    if (trimmed.endsWith('?')) {
      for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index];
        if (token.kind === 'sample') {
          token.detuneCents = clamp(token.detuneCents + 95, -240, 260);
          token.durationMs = clamp(token.durationMs * 0.9, 18, 220);
          break;
        }
      }
    }

    return tokens;
  }

  public estimateDurationMs(text: string, voiceConfig: NarratorVoiceConfig, locale?: string): number {
    const tokens = this.buildTokens(text, voiceConfig, locale);
    const total = tokens.reduce((sum, token) => sum + token.durationMs, 0);
    return Math.max(0, Math.round(total));
  }

  /**
   * Plays tomodachi narration with sample-based synthesis.
   */
  public async play(options: PlayTomodachiNarrationOptions): Promise<NarratorPlaybackHandle> {
    const context = this.getContext();
    if (context.state === 'suspended') {
      await context.resume();
    }

    const tokens = this.buildTokens(options.text, options.voiceConfig, options.locale);
    if (!tokens.length) {
      return {
        durationMs: 0,
        stop: () => undefined,
        unload: () => undefined,
        finished: Promise.resolve(),
      };
    }

    const sampleIds = new Set<TomodachiSampleId>();
    tokens.forEach((token) => {
      if (token.kind === 'sample') sampleIds.add(token.sampleId);
    });

    const sampleEntries = await Promise.all([...sampleIds].map(async (sampleId) => {
      const buffer = await this.getSampleBuffer(sampleId, options.voiceConfig.tomodachi.sampleSet);
      return [sampleId, buffer] as const;
    }));
    const buffers = new Map<TomodachiSampleId, AudioBuffer>(sampleEntries);

    const gainNode = context.createGain();
    gainNode.gain.value = 1;
    gainNode.connect(context.destination);

    const activeSources = new Set<AudioBufferSourceNode>();
    const durationMs = this.estimateDurationMs(options.text, options.voiceConfig, options.locale);
    const startAt = context.currentTime + (AUDIO_START_DELAY_MS / 1000);
    let cursorSec = 0;

    for (const token of tokens) {
      const tokenDurationSec = token.durationMs / 1000;
      if (token.kind === 'pause') {
        cursorSec += tokenDurationSec;
        continue;
      }

      const buffer = buffers.get(token.sampleId);
      if (!buffer) {
        cursorSec += tokenDurationSec;
        continue;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.detune.value = token.detuneCents;

      const nativeDurationSec = buffer.duration || tokenDurationSec;
      const sampleSetRateFactor =
        options.voiceConfig.tomodachi.sampleSet === 'bright'
          ? 1.08
          : options.voiceConfig.tomodachi.sampleSet === 'soft'
            ? 0.94
            : 1;
      source.playbackRate.value = clamp((nativeDurationSec / tokenDurationSec) * sampleSetRateFactor, 0.45, 4.2);

      const sourceStart = startAt + cursorSec;
      source.start(sourceStart);
      source.stop(sourceStart + tokenDurationSec);

      activeSources.add(source);
      source.onended = () => {
        activeSources.delete(source);
        source.disconnect();
      };

      cursorSec += tokenDurationSec;
    }

    let resolveFinished: () => void = () => undefined;
    let finishedResolved = false;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    const resolveOnce = () => {
      if (finishedResolved) return;
      finishedResolved = true;
      resolveFinished();
    };

    const timeoutId = window.setTimeout(() => {
      resolveOnce();
    }, Math.max(0, durationMs + AUDIO_START_DELAY_MS + 24));

    const stop = () => {
      activeSources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // Ignore stop errors for already stopped sources.
        }
        source.disconnect();
      });
      activeSources.clear();
      window.clearTimeout(timeoutId);
      resolveOnce();
    };

    return {
      durationMs,
      stop,
      unload: stop,
      finished,
    };
  }
}

const tomodachiSampleEngine = new TomodachiSampleEngine();

/**
 * Starts tomodachi narration using sample based playback.
 */
export async function playTomodachiSampleNarration(options: PlayTomodachiNarrationOptions): Promise<NarratorPlaybackHandle> {
  return tomodachiSampleEngine.play(options);
}

/**
 * Estimates tomodachi narration duration for timeline/runtime scheduling.
 */
export function estimateTomodachiSampleNarrationDurationMs(text: string, voiceConfig: NarratorVoiceConfig, locale?: string): number {
  return tomodachiSampleEngine.estimateDurationMs(text, voiceConfig, locale);
}
