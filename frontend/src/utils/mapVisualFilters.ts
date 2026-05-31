export type MapTimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'night';

export type VisualFilterPreset = 'sunrise' | 'clear' | 'golden' | 'moonlit' | 'mist';

export type VisualFilterTuning = {
  preset?: VisualFilterPreset;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  hueRotateDeg?: number;
  sepia?: number;
  grayscale?: number;
  blurPx?: number;
};

export type TimeOfDayFilterValue = VisualFilterPreset | VisualFilterTuning;

export type TimeOfDayFilterConfig = Partial<Record<MapTimeOfDay, TimeOfDayFilterValue>>;

export const ALL_MAP_TIMES_OF_DAY: MapTimeOfDay[] = ['dawn', 'morning', 'afternoon', 'night'];

export const VISUAL_FILTER_PRESET_OPTIONS: Array<{ value: '' | VisualFilterPreset; label: string }> = [
  { value: '', label: 'Sin filtro' },
  { value: 'sunrise', label: 'Amanecer cálido' },
  { value: 'clear', label: 'Día limpio' },
  { value: 'golden', label: 'Tarde dorada' },
  { value: 'moonlit', label: 'Noche fría' },
  { value: 'mist', label: 'Bruma tenue' },
];

const PRESET_BASE_VALUES: Record<VisualFilterPreset, Required<VisualFilterTuning>> = {
  sunrise: { preset: 'sunrise', brightness: 104, contrast: 103, saturate: 118, hueRotateDeg: -8, sepia: 16, grayscale: 0, blurPx: 0 },
  clear: { preset: 'clear', brightness: 102, contrast: 104, saturate: 106, hueRotateDeg: 0, sepia: 0, grayscale: 0, blurPx: 0 },
  golden: { preset: 'golden', brightness: 98, contrast: 103, saturate: 112, hueRotateDeg: -14, sepia: 12, grayscale: 0, blurPx: 0 },
  moonlit: { preset: 'moonlit', brightness: 78, contrast: 108, saturate: 82, hueRotateDeg: 12, sepia: 0, grayscale: 0, blurPx: 0 },
  mist: { preset: 'mist', brightness: 94, contrast: 92, saturate: 90, hueRotateDeg: 0, sepia: 0, grayscale: 0, blurPx: 0.2 },
};

const NEUTRAL_FILTER_VALUES: Required<VisualFilterTuning> = {
  preset: 'clear',
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hueRotateDeg: 0,
  sepia: 0,
  grayscale: 0,
  blurPx: 0,
};

const FILTER_LIMITS = {
  brightness: { min: 40, max: 180 },
  contrast: { min: 40, max: 180 },
  saturate: { min: 0, max: 220 },
  hueRotateDeg: { min: -180, max: 180 },
  sepia: { min: 0, max: 100 },
  grayscale: { min: 0, max: 100 },
  blurPx: { min: 0, max: 6 },
} as const;

function clamp(value: unknown, min: number, max: number): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

function isValidPreset(value: unknown): value is VisualFilterPreset {
  return value === 'sunrise' || value === 'clear' || value === 'golden' || value === 'moonlit' || value === 'mist';
}

/**
 * Normalizes a persisted filter value into a safe tuning object.
 * Supports legacy string presets and the new object-based tuning format.
 */
export function normalizeFilterValue(value?: TimeOfDayFilterValue | null): VisualFilterTuning | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    return isValidPreset(value) ? { preset: value } : undefined;
  }
  if (typeof value !== 'object') return undefined;

  const preset = isValidPreset(value.preset) ? value.preset : undefined;
  const normalized: VisualFilterTuning = {
    ...(preset ? { preset } : {}),
    ...(clamp(value.brightness, FILTER_LIMITS.brightness.min, FILTER_LIMITS.brightness.max) !== undefined ? { brightness: clamp(value.brightness, FILTER_LIMITS.brightness.min, FILTER_LIMITS.brightness.max) } : {}),
    ...(clamp(value.contrast, FILTER_LIMITS.contrast.min, FILTER_LIMITS.contrast.max) !== undefined ? { contrast: clamp(value.contrast, FILTER_LIMITS.contrast.min, FILTER_LIMITS.contrast.max) } : {}),
    ...(clamp(value.saturate, FILTER_LIMITS.saturate.min, FILTER_LIMITS.saturate.max) !== undefined ? { saturate: clamp(value.saturate, FILTER_LIMITS.saturate.min, FILTER_LIMITS.saturate.max) } : {}),
    ...(clamp(value.hueRotateDeg, FILTER_LIMITS.hueRotateDeg.min, FILTER_LIMITS.hueRotateDeg.max) !== undefined ? { hueRotateDeg: clamp(value.hueRotateDeg, FILTER_LIMITS.hueRotateDeg.min, FILTER_LIMITS.hueRotateDeg.max) } : {}),
    ...(clamp(value.sepia, FILTER_LIMITS.sepia.min, FILTER_LIMITS.sepia.max) !== undefined ? { sepia: clamp(value.sepia, FILTER_LIMITS.sepia.min, FILTER_LIMITS.sepia.max) } : {}),
    ...(clamp(value.grayscale, FILTER_LIMITS.grayscale.min, FILTER_LIMITS.grayscale.max) !== undefined ? { grayscale: clamp(value.grayscale, FILTER_LIMITS.grayscale.min, FILTER_LIMITS.grayscale.max) } : {}),
    ...(clamp(value.blurPx, FILTER_LIMITS.blurPx.min, FILTER_LIMITS.blurPx.max) !== undefined ? { blurPx: clamp(value.blurPx, FILTER_LIMITS.blurPx.min, FILTER_LIMITS.blurPx.max) } : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/**
 * Returns the preset portion for a filter value, if present.
 */
export function getFilterPreset(value?: TimeOfDayFilterValue | null): VisualFilterPreset | undefined {
  const normalized = normalizeFilterValue(value);
  return normalized?.preset;
}

/**
 * Resolves a filter value into concrete numeric values ready for rendering.
 * Preset defaults are merged with any explicit user overrides.
 */
export function getResolvedFilterValues(value?: TimeOfDayFilterValue | null): Required<VisualFilterTuning> | undefined {
  const normalized = normalizeFilterValue(value);
  if (!normalized) return undefined;

  const base = normalized.preset ? PRESET_BASE_VALUES[normalized.preset] : NEUTRAL_FILTER_VALUES;
  return {
    preset: normalized.preset ?? base.preset,
    brightness: normalized.brightness ?? base.brightness,
    contrast: normalized.contrast ?? base.contrast,
    saturate: normalized.saturate ?? base.saturate,
    hueRotateDeg: normalized.hueRotateDeg ?? base.hueRotateDeg,
    sepia: normalized.sepia ?? base.sepia,
    grayscale: normalized.grayscale ?? base.grayscale,
    blurPx: normalized.blurPx ?? base.blurPx,
  };
}

/**
 * Builds a CSS filter string from a preset and/or manual tuning overrides.
 * Returns undefined when no effective visual change is present.
 */
export function getVisualFilterCss(value?: TimeOfDayFilterValue | null): string | undefined {
  const resolved = getResolvedFilterValues(value);
  if (!resolved) return undefined;

  const hasEffect =
    resolved.brightness !== 100
    || resolved.contrast !== 100
    || resolved.saturate !== 100
    || resolved.hueRotateDeg !== 0
    || resolved.sepia !== 0
    || resolved.grayscale !== 0
    || resolved.blurPx !== 0;

  if (!hasEffect) return undefined;

  return [
    `brightness(${resolved.brightness / 100})`,
    `contrast(${resolved.contrast / 100})`,
    `saturate(${resolved.saturate / 100})`,
    `hue-rotate(${resolved.hueRotateDeg}deg)`,
    `sepia(${resolved.sepia / 100})`,
    `grayscale(${resolved.grayscale / 100})`,
    `blur(${resolved.blurPx}px)`,
  ].join(' ');
}

/**
 * Normalizes and removes empty entries from a per-time-of-day filter map.
 */
export function normalizeFilterConfig(config?: TimeOfDayFilterConfig | null): TimeOfDayFilterConfig | undefined {
  if (!config) return undefined;
  const entries = Object.entries(config).flatMap((entry): Array<[MapTimeOfDay, VisualFilterTuning]> => {
    const [key, value] = entry;
    if (!ALL_MAP_TIMES_OF_DAY.includes(key as MapTimeOfDay)) return [];
    const normalizedValue = normalizeFilterValue(value);
    return normalizedValue ? [[key as MapTimeOfDay, normalizedValue]] : [];
  });
  return entries.length ? (Object.fromEntries(entries) as TimeOfDayFilterConfig) : undefined;
}