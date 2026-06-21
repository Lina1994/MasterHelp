/**
 * Paper / sheet-format presets and pure layout planner used by both the
 * PDF export pipeline (`exportCardsAsPdf`) and the browser print pipeline
 * (`printCardsViaBrowser`). Pushing the geometry into a pure function
 * keeps the two pipelines honest about which dimensions they are emitting.
 */

import { resolveCardDimensions } from './cardSizes';
import type { CardOrientation, CardSizePreset, CardTemplate } from '../types/cardTemplates';

/** Built-in sheet format keys. `CARD` is the legacy single-card-per-page mode. */
export type PageFormatPreset =
  | 'CARD'
  | 'A4'
  | 'A3'
  | 'A5'
  | 'LETTER'
  | 'POSTAL'
  | 'BUSINESS_CARD';

/** Static description of a sheet format, in millimetres. */
export interface PageFormatDefinition {
  key: Exclude<PageFormatPreset, 'CARD'>;
  /** Human-readable label shown in the generator dialog. */
  label: string;
  /** Sheet width in mm (portrait orientation reference). */
  widthMm: number;
  /** Sheet height in mm (portrait orientation reference). */
  heightMm: number;
  /** Short tooltip describing the use case. */
  description: string;
}

/** Built-in sheet formats, ordered from largest to smallest. */
export const PAPER_FORMATS: PageFormatDefinition[] = [
  {
    key: 'A3',
    label: 'A3 (297×420 mm)',
    widthMm: 297,
    heightMm: 420,
    description: 'Hoja grande; útil cuando cada carta es grande.',
  },
  {
    key: 'A4',
    label: 'A4 (210×297 mm)',
    widthMm: 210,
    heightMm: 297,
    description: 'Estándar internacional; el más común para imprimir.',
  },
  {
    key: 'LETTER',
    label: 'Carta US (216×279 mm)',
    widthMm: 216,
    heightMm: 279,
    description: 'Estándar americano (Letter).',
  },
  {
    key: 'A5',
    label: 'A5 (148×210 mm)',
    widthMm: 148,
    heightMm: 210,
    description: 'Mitad de A4; ideal cuando imprimimos en hojas más pequeñas.',
  },
  {
    key: 'POSTAL',
    label: 'Postal (100×150 mm)',
    widthMm: 100,
    heightMm: 150,
    description: 'Postal estándar; útil para cartas casi a página completa.',
  },
  {
    key: 'BUSINESS_CARD',
    label: 'Tarjeta de visita (85×55 mm)',
    widthMm: 85,
    heightMm: 55,
    description: 'Tarjeta de visita; máxima densidad.',
  },
];

/**
 * Returns the static definition for a sheet preset, or `null` when the
 * caller asked for the legacy `CARD` mode (one card = one page, page size
 * matches the card).
 */
export function getPaperFormat(preset: PageFormatPreset): PageFormatDefinition | null {
  if (preset === 'CARD') return null;
  return PAPER_FORMATS.find((p) => p.key === preset) ?? null;
}

/**
 * Geometric layout describing how to pack cards of a fixed size onto one
 * sheet. Returned by {@link planCardLayout} and consumed by both the PDF
 * and the print pipelines to position each card at the right (x, y) in mm.
 */
export interface PageLayoutPlan {
  /** Final sheet width after the auto-rotation decision. */
  pageWidthMm: number;
  /** Final sheet height after the auto-rotation decision. */
  pageHeightMm: number;
  cardWidthMm: number;
  cardHeightMm: number;
  /** True iff the algorithm swapped the sheet to landscape to fit more cards. */
  pageRotated: boolean;
  /** Number of card columns per sheet. */
  cols: number;
  /** Number of card rows per sheet. */
  rows: number;
  /** `cols * rows`. Zero when the card does not fit this sheet at all. */
  perPage: number;
  /** Margin applied on all four sheet edges, in mm. */
  marginMm: number;
  /** Gap between adjacent cards in mm. */
  gapMm: number;
  /**
   * Top-left (x, y) of each cell, in mm from the sheet's top-left corner,
   * ordered row-major. Length is `perPage`.
   */
  positions: Array<{ x: number; y: number }>;
}

/**
 * Pure planner: given a card size and a sheet size, decide how many
 * columns × rows fit and produce the per-cell positions in mm. The card
 * itself is never rotated (we leave the template geometry alone); the
 * sheet is auto-rotated to whichever orientation packs more cards.
 *
 * `cols`/`rows`/`perPage` are 0 when the card physically does not fit the
 * sheet with the current margin + gap. Callers should detect this and
 * fall back to `CARD` mode (one card per page, sheet = card) so they
 * never silently drop cards.
 */
export function planCardLayout(
  cardWidthMm: number,
  cardHeightMm: number,
  pageWidthMm: number,
  pageHeightMm: number,
  options: { marginMm?: number; gapMm?: number; autoOrientPage?: boolean } = {},
): PageLayoutPlan {
  const margin = options.marginMm ?? 5;
  const gap = options.gapMm ?? 2;
  const autoOrient = options.autoOrientPage ?? true;

  /** Per-orientation grid for the current card size. Returns 0/0 if it doesn't fit. */
  function computeForOrientation(
    sheetW: number,
    sheetH: number,
    cardW: number,
    cardH: number,
  ): { cols: number; rows: number; perPage: number } {
    const usableW = Math.max(0, sheetW - 2 * margin);
    const usableH = Math.max(0, sheetH - 2 * margin);
    // Floor gives 0 when the card is wider than the usable area (or the
    // gap alone does not leave room). Returning 0 lets callers detect a
    // non-fit and fall back rather than silently cropping.
    const cols = Math.max(0, Math.floor((usableW + gap) / (cardW + gap)));
    const rows = Math.max(0, Math.floor((usableH + gap) / (cardH + gap)));
    return { cols, rows, perPage: cols * rows };
  }

  const portrait = computeForOrientation(pageWidthMm, pageHeightMm, cardWidthMm, cardHeightMm);
  const landscape = autoOrient
    ? computeForOrientation(pageHeightMm, pageWidthMm, cardWidthMm, cardHeightMm)
    : portrait;

  let bestPageW = pageWidthMm;
  let bestPageH = pageHeightMm;
  let pageRotated = false;
  let best = portrait;
  if (landscape.perPage > portrait.perPage) {
    bestPageW = pageHeightMm;
    bestPageH = pageWidthMm;
    pageRotated = true;
    best = landscape;
  }

  const positions: Array<{ x: number; y: number }> = [];
  if (best.perPage > 0) {
    const usableW = Math.max(0, bestPageW - 2 * margin);
    const usableH = Math.max(0, bestPageH - 2 * margin);
    const gridW = best.cols * cardWidthMm + (best.cols - 1) * gap;
    const gridH = best.rows * cardHeightMm + (best.rows - 1) * gap;
    // Center the grid inside the usable area when there is leftover space
    // (e.g. 5 cards on A4 leave a strip on one side).
    const offsetX = margin + Math.max(0, (usableW - gridW) / 2);
    const offsetY = margin + Math.max(0, (usableH - gridH) / 2);
    for (let r = 0; r < best.rows; r += 1) {
      for (let c = 0; c < best.cols; c += 1) {
        positions.push({
          x: offsetX + c * (cardWidthMm + gap),
          y: offsetY + r * (cardHeightMm + gap),
        });
      }
    }
  }

  return {
    pageWidthMm: bestPageW,
    pageHeightMm: bestPageH,
    cardWidthMm,
    cardHeightMm,
    pageRotated,
    cols: best.cols,
    rows: best.rows,
    perPage: best.perPage,
    marginMm: margin,
    gapMm: gap,
    positions,
  };
}

/**
 * Convenience wrapper that resolves a `CardTemplate`'s effective size
 * (preset + orientation) and then runs {@link planCardLayout}. Returns
 * the `CARD` fallback plan (page = card size, 1 per page) when the chosen
 * preset is null (legacy CARD mode) or the chosen sheet cannot host the
 * card with the requested margins.
 */
export function planCardLayoutForTemplate(
  template: Pick<CardTemplate, 'sizePreset' | 'orientation' | 'widthMm' | 'heightMm'>,
  sheet: { widthMm: number; heightMm: number } | null,
  options: { marginMm?: number; gapMm?: number } = {},
): PageLayoutPlan | null {
  const cardDims = resolveCardDimensions(
    template.sizePreset,
    template.orientation,
    { widthMm: template.widthMm, heightMm: template.heightMm },
  );
  if (!sheet) {
    // CARD mode: one card per page, sheet size = card size. Still emit a
    // plan with `perPage = 1` so callers can use a single code path.
    return {
      pageWidthMm: cardDims.widthMm,
      pageHeightMm: cardDims.heightMm,
      cardWidthMm: cardDims.widthMm,
      cardHeightMm: cardDims.heightMm,
      pageRotated: template.orientation === 'landscape',
      cols: 1,
      rows: 1,
      perPage: 1,
      marginMm: 0,
      gapMm: 0,
      positions: [{ x: 0, y: 0 }],
    };
  }
  const plan = planCardLayout(cardDims.widthMm, cardDims.heightMm, sheet.widthMm, sheet.heightMm, options);
  if (plan.perPage === 0) {
    // Card is bigger than the sheet; fall back to CARD mode rather than
    // silently cropping. Caller can also surface a warning to the user.
    return {
      pageWidthMm: cardDims.widthMm,
      pageHeightMm: cardDims.heightMm,
      cardWidthMm: cardDims.widthMm,
      cardHeightMm: cardDims.heightMm,
      pageRotated: template.orientation === 'landscape',
      cols: 1,
      rows: 1,
      perPage: 1,
      marginMm: 0,
      gapMm: 0,
      positions: [{ x: 0, y: 0 }],
    };
  }
  return plan;
}

/**
 * Resolves a template's effective printable size given a preset and
 * orientation. Re-exported for callers that don't want to depend on
 * `cardSizes` directly.
 */
export function resolveTemplateCardSize(
  sizePreset: CardSizePreset,
  orientation: CardOrientation,
  custom?: { widthMm: number; heightMm: number },
): { widthMm: number; heightMm: number } {
  return resolveCardDimensions(sizePreset, orientation, custom);
}
