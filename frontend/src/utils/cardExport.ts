import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { CardEntityPayload, CardTemplate } from '../types/cardTemplates';
import { resolveCardDimensions } from './cardSizes';
import {
  getPaperFormat,
  planCardLayoutForTemplate,
  type PageFormatPreset,
} from './paperFormats';
import CardRenderer from '../components/cards/CardRenderer';

/**
 * Pairs a (mounted) DOM card element with the React `Root` controlling it.
 * Tracking the root lets us `unmount()` it before dropping the node from the
 * DOM to avoid the React 18 fiber leak.
 */
interface MountedCard {
  el: HTMLDivElement;
  /** React root controlling the element; non-null in current code paths. */
  root: Root;
}

/**
 * Browsers use 96 DPI for CSS `mm` resolution, so 1mm ≈ 3.7795 px. We expose
 * this constant because html2canvas reads pixel sizes off the DOM — keeping
 * the export pipeline in sync with the on-screen preview.
 */
const MM_TO_PX = 96 / 25.4;

/** How long to wait after mounting before letting html2canvas capture. The
 * renderer paints and decodes images asynchronously, so a short wait makes
 * the timed race between React commits and DOM paint deterministic.
 */
const POST_MOUNT_PAUSE_MS = 250;

/**
 * Builds a card DOM element by mounting the React renderer through a
 * `createRoot`. The card is positioned near the viewport but covered by an
 * overlay layer so it doesn't appear visible to the user; this avoids the
 * Chromium "skip off-screen rendering" optimisation that otherwise produces
 * blank canvases.
 */
function mountCardElement(template: CardTemplate, entity: CardEntityPayload): MountedCard {
  const el = document.createElement('div');
  const dims = resolveCardDimensions(template.sizePreset, template.orientation, {
    widthMm: template.widthMm,
    heightMm: template.heightMm,
  });
  // Render in absolute pixels to avoid surprises between CSS-mm and how
  // html2canvas snapshots the live pixel tree.
  el.style.width = `${dims.widthMm * MM_TO_PX}px`;
  el.style.height = `${dims.heightMm * MM_TO_PX}px`;
  el.style.position = 'relative';
  el.style.background = 'white';
  el.style.boxSizing = 'border-box';
  el.style.color = '#000';
  el.className = 'card-print-canvas';
  el.dataset.cardExportCanvas = 'true';
  const root = createRoot(el);
  // React 18 commits asynchronously; flushSync forces a synchronous commit
  // so the DOM tree is fully populated before html2canvas walks it.
  flushSync(() => {
    root.render(createElement(CardRenderer, { template, entity }));
  });
  return { el, root };
}

/**
 * Mounts card elements into a host container that is positioned absolutely at
 * the top of the viewport but visually hidden under the existing app chrome
 * (very high z-index assigned by the caller of the export dialog). Putting
 * the host near coordinates (0, 0) ensures Chromium paints it, which avoids
 * blank html2canvas snapshots.
 */
function mountCardsForExport(cards: MountedCard[]): { host: HTMLDivElement; cards: MountedCard[] } {
  const host = document.createElement('div');
  // Parked far off-screen (`left: -99999px`) instead of `opacity: 0`:
  // html2canvas honours CSS opacity, so the previous host produced blank
  // canvases for every card and the resulting PDF was empty when exporting
  // any non-trivial selection. Off-screen positioning keeps the element
  // in the rendered tree (so html2canvas captures it correctly) while
  // hiding it from the user. The print stylesheet restores `position:
  // static` so the cards appear in the printed page flow.
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '-99999px';
  host.style.zIndex = '-1';
  host.style.pointerEvents = 'none';
  host.dataset.cardsExportHost = 'true';
  document.body.appendChild(host);
  for (const card of cards) host.appendChild(card.el);
  return { host, cards };
}

/** Detaches the host and unmounts every React root it contains. */
function unmountExportHost(payload: { host: HTMLDivElement; cards: MountedCard[] }): void {
  for (const c of payload.cards) {
    try { c.root.unmount(); } catch { /* root already torn down by React */ }
  }
  if (payload.host?.parentNode) payload.host.parentNode.removeChild(payload.host);
}

/** Yields once the browser has painted, picked up images and emitted a frame. */
function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    } else {
      setTimeout(resolve, POST_MOUNT_PAUSE_MS);
    }
  });
}

/**
 * Renders every entity into a jsPDF document and downloads it. When no
 * `pageFormat` is supplied the legacy `CARD` mode kicks in: each card is
 * its own page sized exactly to the card. When a paper preset is supplied
 * the layout planner packs multiple cards per sheet and the algorithm
 * auto-rotates the sheet to whichever orientation fits the most cards.
 */
export async function exportCardsAsPdf(
  template: CardTemplate,
  entities: CardEntityPayload[],
  options: {
    filename?: string;
    scale?: number;
    /** Paper preset (e.g. `A4`). Pass `undefined` / `'CARD'` for the legacy
     *  one-card-per-page behaviour. */
    pageFormat?: PageFormatPreset;
    /** Per-sheet margin in mm. Defaults to 5. */
    marginMm?: number;
    /** Gap between adjacent cards in mm. Defaults to 2. */
    gapMm?: number;
  } = {},
): Promise<void> {
  if (entities.length === 0) return;
  const cardDims = resolveCardDimensions(template.sizePreset, template.orientation, {
    widthMm: template.widthMm,
    heightMm: template.heightMm,
  });
  const sheet = options.pageFormat && options.pageFormat !== 'CARD'
    ? getPaperFormat(options.pageFormat)
    : null;
  const plan = planCardLayoutForTemplate(template, sheet, {
    marginMm: options.marginMm,
    gapMm: options.gapMm,
  })!;
  const doc = new jsPDF({
    unit: 'mm',
    format: [plan.pageWidthMm, plan.pageHeightMm],
    orientation: plan.pageRotated ? 'landscape' : 'portrait',
    compress: true,
  });
  const scale = options.scale ?? 2.5;
  const mounted = entities.map((entity) => mountCardElement(template, entity));
  const payload = mountCardsForExport(mounted);
  try {
    // Give the browser time to paint + decode any background images before
    // html2canvas walks the DOM. Without this flushSync alone is not enough.
    await waitForNextPaint();
    // Phase 1: capture every card into its own image-data URI. Kept in
    // memory only long enough to place it on a jsPDF page; we don't retain
    // more than `entities.length` strings at a time.
    const imageData: string[] = [];
    for (let i = 0; i < mounted.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequential rendering keeps memory usage lower
      const canvas = await html2canvas(mounted[i].el, {
        scale,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      if (imgData.length < 256) {
        // Defensive guard: a "data:image/png;base64," string < 256 chars can
        // only be a 1×1 empty image. Bail out so callers can show a real error.
        throw new Error('Empty card capture (likely React render race).');
      }
      imageData.push(imgData);
    }
    // Phase 2: place the captured images on the planned pages. The layout
    // planner has already chosen how many cells per sheet and where each
    // cell lives (see `paperFormats.planCardLayout`).
    for (let i = 0; i < imageData.length; i += 1) {
      const slotIndex = i % plan.perPage;
      if (i > 0 && slotIndex === 0) {
        doc.addPage(
          [plan.pageWidthMm, plan.pageHeightMm],
          plan.pageRotated ? 'landscape' : 'portrait',
        );
      }
      const pos = plan.positions[slotIndex];
      doc.addImage(
        imageData[i],
        'PNG',
        pos.x,
        pos.y,
        plan.cardWidthMm,
        plan.cardHeightMm,
        undefined,
        'FAST',
      );
    }
  } finally {
    unmountExportHost(payload);
  }
  doc.save(options.filename ?? `cartas-${Date.now()}.pdf`);
}

/**
 * Opens the native browser print dialog with the cards laid out onto the
 * chosen paper format. When `options.pageFormat` is omitted (or set to
 * `'CARD'`) the legacy behaviour kicks in: each card fills its own page. When
 * a paper preset (A4, A3, A5, …) is provided the layout planner packs as
 * many cards as fit per sheet and tags each sheet-sized `<div>` with
 * `page-break-after: always` so the browser prints each one separately.
 *
 * Cleanup is robust to the user cancelling the dialog: `afterprint`,
 * `pagehide`/`beforeunload` and a 30-second safety net ensure the host and
 * injected style tag are always torn down.
 */
export function printCardsViaBrowser(
  template: CardTemplate,
  entities: CardEntityPayload[],
  options: {
    pageFormat?: PageFormatPreset;
    marginMm?: number;
    gapMm?: number;
  } = {},
): void {
  const cardDims = resolveCardDimensions(template.sizePreset, template.orientation, {
    widthMm: template.widthMm,
    heightMm: template.heightMm,
  });
  const sheet = options.pageFormat && options.pageFormat !== 'CARD'
    ? getPaperFormat(options.pageFormat)
    : null;
  const plan = planCardLayoutForTemplate(template, sheet, {
    marginMm: options.marginMm,
    gapMm: options.gapMm,
  })!;

  const mounted = entities.map((entity) => {
    const card = mountCardElement(template, entity);
    card.el.dataset.cardPrintCanvas = 'true';
    return card;
  });

  // Build the off-screen host ourselves so we can subdivide it into
  // sheet-sized `<div>` wrappers. Each wrapper carries the cards that fit
  // on one printed sheet, positioned in mm from the wrapper's top-left.
  const host = document.createElement('div');
  // Parked far off-screen (`left: -99999px`) so html2canvas users get
  // correctly-rendered cards and the user does not see them.
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '-99999px';
  host.style.zIndex = '-1';
  host.style.pointerEvents = 'none';
  host.dataset.cardsExportHost = 'true';
  host.dataset.cardPrintHost = 'true';
  document.body.appendChild(host);

  for (let chunkStart = 0; chunkStart < mounted.length; chunkStart += plan.perPage) {
    const pageDiv = document.createElement('div');
    pageDiv.dataset.cardPrintPage = 'true';
    pageDiv.style.position = 'relative';
    pageDiv.style.width = `${plan.pageWidthMm * MM_TO_PX}px`;
    pageDiv.style.height = `${plan.pageHeightMm * MM_TO_PX}px`;
    pageDiv.style.overflow = 'hidden';
    pageDiv.style.background = 'white';
    pageDiv.style.boxSizing = 'border-box';
    const chunkEnd = Math.min(chunkStart + plan.perPage, mounted.length);
    for (let i = chunkStart; i < chunkEnd; i += 1) {
      const cellIndex = i - chunkStart;
      const card = mounted[i];
      const pos = plan.positions[cellIndex];
      // Override the inline styles that mountCardElement set up so the
      // card now sits at the planned (x, y) and is sized to the planned
      // card box (identical to its template size here, but kept general
      // for future card-shrink modes).
      card.el.style.position = 'absolute';
      card.el.style.left = `${pos.x * MM_TO_PX}px`;
      card.el.style.top = `${pos.y * MM_TO_PX}px`;
      card.el.style.width = `${plan.cardWidthMm * MM_TO_PX}px`;
      card.el.style.height = `${plan.cardHeightMm * MM_TO_PX}px`;
      pageDiv.appendChild(card.el);
    }
    host.appendChild(pageDiv);
  }

  // Inject @page CSS sized to the planned sheet. `landscape` keyword keeps
  // the print engine's own page-orientation consistent with our layout
  // plan; without it some drivers swap back to portrait when the page
  // number is greater than 1 and the layout falls apart.
  const styleEl = document.createElement('style');
  styleEl.dataset.cardPrintStyles = 'true';
  const pageDecl = plan.pageRotated
    ? `size: ${plan.pageWidthMm}mm ${plan.pageHeightMm}mm landscape;`
    : `size: ${plan.pageWidthMm}mm ${plan.pageHeightMm}mm;`;
  styleEl.textContent = `
    @page { ${pageDecl} margin: 0; }
    @media print {
      html, body { visibility: hidden !important; }
      [data-card-print-host="true"], [data-card-print-host="true"] * { visibility: visible !important; }
      /* Bring the off-screen export host back into the printable flow so
         the browser prints each sheet-sized <div> on a separate page. */
      [data-card-print-host="true"] {
        position: static !important;
        left: auto !important;
        top: auto !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      [data-card-print-page="true"] {
        page-break-after: always;
        page-break-inside: avoid;
        position: relative !important;
      }
      [data-card-print-page="true"]:last-of-type {
        page-break-after: auto;
      }
    }
  `;
  document.head.appendChild(styleEl);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    styleEl.remove();
    unmountExportHost({ host, cards: mounted });
    window.removeEventListener('afterprint', cleanup);
    window.removeEventListener('pagehide', cleanup);
    window.removeEventListener('beforeunload', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup);
  setTimeout(cleanup, 30000);
  // Two `requestAnimationFrame` cycles give Chromium enough time to
  // commit layout, decode any image-bearing slots and paint every card
  // before the print engine starts. Without this, printing immediately
  // after `flushSync` mounting 9+ cards reproduces the
  // "Esta aplicación no admite la vista previa de impresión" error
  // because the print job begins before the cards are visible to the
  // rasteriser.
  const firePrint = () => window.print();
  window.requestAnimationFrame(() => window.requestAnimationFrame(firePrint));
}
