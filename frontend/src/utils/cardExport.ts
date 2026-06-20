import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { CardEntityPayload, CardTemplate } from '../types/cardTemplates';
import { resolveCardDimensions } from './cardSizes';
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
  host.style.position = 'absolute';
  host.style.top = '0';
  host.style.left = '0';
  host.style.zIndex = '-1';
  host.style.pointerEvents = 'none';
  host.style.opacity = '0'; // visible to html2canvas, hidden from the eye
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
 * Renders every entity into a separate jsPDF page and downloads the PDF.
 * Each card is its own page sized exactly to the physical card.
 */
export async function exportCardsAsPdf(
  template: CardTemplate,
  entities: CardEntityPayload[],
  options: { filename?: string; scale?: number } = {},
): Promise<void> {
  if (entities.length === 0) return;
  const dims = resolveCardDimensions(template.sizePreset, template.orientation, {
    widthMm: template.widthMm,
    heightMm: template.heightMm,
  });
  const doc = new jsPDF({
    unit: 'mm',
    format: [dims.widthMm, dims.heightMm],
    orientation: template.orientation === 'landscape' ? 'landscape' : 'portrait',
    compress: true,
  });
  const scale = options.scale ?? 2.5;
  const mounted = entities.map((entity) => mountCardElement(template, entity));
  const payload = mountCardsForExport(mounted);
  try {
    // Give the browser time to paint + decode any background images before
    // html2canvas walks the DOM. Without this flushSync alone is not enough.
    await waitForNextPaint();
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
      if (i > 0) {
        doc.addPage([dims.widthMm, dims.heightMm], template.orientation === 'landscape' ? 'landscape' : 'portrait');
      }
      const renderW = doc.internal.pageSize.getWidth();
      const renderH = doc.internal.pageSize.getHeight();
      doc.addImage(imgData, 'PNG', 0, 0, renderW, renderH, undefined, 'FAST');
    }
  } finally {
    unmountExportHost(payload);
  }
  doc.save(options.filename ?? `cartas-${Date.now()}.pdf`);
}

/**
 * Opens the native browser print dialog with the cards rendered as
 * page-sized image regions. Each card becomes one printable page with the
 * exact mm dimensions for the chosen preset, so the user can "Save as PDF"
 * or send it directly to a printer.
 *
 * Cleanup is robust to the user cancelling the dialog: `afterprint`,
 * `pagehide`/`beforeunload` and a 30-second safety net ensure the host and
 * injected style tag are always torn down.
 */
export function printCardsViaBrowser(
  template: CardTemplate,
  entities: CardEntityPayload[],
): void {
  const dims = resolveCardDimensions(template.sizePreset, template.orientation, {
    widthMm: template.widthMm,
    heightMm: template.heightMm,
  });
  const mounted = entities.map((entity) => {
    const card = mountCardElement(template, entity);
    card.el.dataset.cardPrintCanvas = 'true';
    return card;
  });
  const payload = mountCardsForExport(mounted);
  payload.host.dataset.cardPrintHost = 'true';

  const styleEl = document.createElement('style');
  styleEl.dataset.cardPrintStyles = 'true';
  styleEl.textContent = `
    @page { size: ${dims.widthMm}mm ${dims.heightMm}mm; margin: 0; }
    @media print {
      html, body { visibility: hidden !important; }
      [data-card-print-host="true"], [data-card-print-host="true"] * { visibility: visible !important; }
      [data-card-print-host="true"] > .card-print-canvas { page-break-after: always; }
      [data-card-print-canvas="true"] {
        position: relative !important;
        left: 0 !important; top: 0 !important;
        width: ${dims.widthMm * MM_TO_PX}px !important;
        height: ${dims.heightMm * MM_TO_PX}px !important;
      }
      [data-card-print-canvas="true"]:last-of-type { page-break-after: auto; }
    }
  `;
  document.head.appendChild(styleEl);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    styleEl.remove();
    unmountExportHost(payload);
    window.removeEventListener('afterprint', cleanup);
    window.removeEventListener('pagehide', cleanup);
    window.removeEventListener('beforeunload', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup);
  setTimeout(cleanup, 30000);
  window.print();
}
