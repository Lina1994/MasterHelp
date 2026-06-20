import type { CardOrientation, CardSizePreset } from '../types/cardTemplates';

/**
 * Static description of a card size preset, in millimetres. Matches the
 * physical sizes of classic TCG / business card formats so the printed
 * cards line up with standard sleeves / sheet protectors.
 */
export interface CardSizeDefinition {
  key: CardSizePreset;
  /** UI label, kept here so we can reuse it in editor + PDF export dialogs. */
  label: string;
  widthMm: number;
  heightMm: number;
  /** Compact description shown in tooltips. */
  description: string;
}

/**
 * Catalogue of built-in card size presets. CUSTOM is intentionally omitted
 * from this list — it represents an arbitrary user-defined size.
 */
export const CARD_SIZE_PRESETS: CardSizeDefinition[] = [
  {
    key: 'POKER',
    label: 'Póquer (Magic)',
    widthMm: 63,
    heightMm: 88,
    description: 'Tamaño Magic: The Gathering / Póquer (63×88 mm).',
  },
  {
    key: 'MINI',
    label: 'Euro Mini',
    widthMm: 41,
    heightMm: 63,
    description: 'Cartas mini europeas (41×63 mm).',
  },
  {
    key: 'BRIDGE',
    label: 'Bridge',
    widthMm: 57,
    heightMm: 89,
    description: 'Tamaño Bridge (57×89 mm).',
  },
  {
    key: 'TAROT',
    label: 'Tarot',
    widthMm: 70,
    heightMm: 120,
    description: 'Tamaño Tarot (70×120 mm).',
  },
  {
    key: 'LETTER',
    label: 'Carta A4',
    widthMm: 95,
    heightMm: 130,
    description: 'Media hoja A4 (95×130 mm).',
  },
];

/**
 * Returns the size definition for a preset, falling back to POKER if the
 * preset is unknown.
 */
export function getCardSizeDefinition(preset: CardSizePreset): CardSizeDefinition {
  return (
    CARD_SIZE_PRESETS.find((d) => d.key === preset) ?? {
      key: 'POKER',
      label: 'Personalizado',
      widthMm: 63,
      heightMm: 88,
      description: 'Tamaño personalizado.',
    }
  );
}

/**
 * Resolves the actual width/height for a template based on its preset and
 * orientation. When orientation is `landscape` the dimensions are swapped.
 */
export function resolveCardDimensions(
  preset: CardSizePreset,
  orientation: CardOrientation,
  custom?: { widthMm: number; heightMm: number },
): { widthMm: number; heightMm: number } {
  const base = preset === 'CUSTOM'
    ? custom ?? { widthMm: 63, heightMm: 88 }
    : { widthMm: getCardSizeDefinition(preset).widthMm, heightMm: getCardSizeDefinition(preset).heightMm };
  if (orientation === 'landscape') {
    return { widthMm: base.heightMm, heightMm: base.widthMm };
  }
  return base;
}
