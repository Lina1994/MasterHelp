import { Box, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CardRenderer from './CardRenderer';
import LiveSlotOverlay from './LiveSlotOverlay';
import type { CardEntityPayload, CardTemplate } from '../../types/cardTemplates';
import { entityNormalisers } from './cardsFieldCatalog';

const MM_TO_PX = 96 / 25.4;

/** Bounds of the preview Paper's scroll viewport. Lifted to the parent
 *  via {@link CardPreview}'s `onScrollBoundsChange` callback so the
 *  toolbar can disable individual pan arrow buttons with a value that
 *  re-renders whenever the Paper scrolls. */
export type CardPreviewScrollBounds = {
  /** True iff there's still room to scroll LEFT (scrollLeft > 0). */
  left: boolean;
  /** True iff there's still room to scroll RIGHT (scrollLeft + clientWidth < scrollWidth). */
  right: boolean;
  /** True iff there's still room to scroll UP (scrollTop > 0). */
  up: boolean;
  /** True iff there's still room to scroll DOWN (scrollTop + clientHeight < scrollHeight). */
  down: boolean;
};

/**
 * On-screen preview of a template applied to a sample entity. The preview
 * scales the card to fit the available width so the user can see it at any
 * zoom level without overwhelming the dialog.
 *
 * When `interactive` is true a {@link LiveSlotOverlay} sits on top of the
 * renderer so the editor can drag/resize slots visually. If `sampleEntity`
 * is omitted we fabricate a minimal one derived from the first binding in
 * the template so the slots render against real data.
 *
 * `zoom` lets the editor give the user a bigger canvas: it multiplies the
 * base fit-to-window scale. The PX-to-MM conversion inside
 * {@link LiveSlotOverlay} keeps working untouched because the outer box
 * (which the overlay's `rect.width` reads) is sized at the final display
 * scale — not at the natural card pixel size.
 */
/**
 * Imperative handle exposed by {@link CardPreview} via `forwardRef` so the
 * editor dialog's toolbar can drive `scrollBy(dx, dy)` from outside the
 * Paper. The horizontal scrollbar lives at the bottom of the inner Paper
 * and drops below the column's fold whenever the user is inspecting the
 * top of a zoomed card; surfacing programmatic pan buttons in the toolbar
 * keeps that scroll reachable without forcing a vertical scroll first.
 *
 * Note that we deliberately DO NOT expose `canScroll(...)` on the handle.
 * It used to be here so the parent could disable individual pan arrow
 * buttons when at the boundary, but the parent's `disabled` prop is
 * captured at render time and the parent's render doesn't re-fire when a
 * child component's internal state changes — so any read of the Paper's
 * metrics via the handle would go stale within a single fast drag-to-pan.
 * Instead, the scroll bounds are mirrored up to the parent via the
 * `onScrollBoundsChange` callback (see props below), and the parent owns
 * the boolean tuple that the buttons read.
 */
export type CardPreviewHandle = {
  /**
   * Scrolls the preview Paper by `(dx, dy)` CSS pixels in each axis. The
   * browser's `scrollBy` builds in boundary clamping (no overshoot past
   * `scrollWidth - clientWidth` / `scrollHeight - clientHeight`), so
   * callers can pass any size without pre-checking the scroll metrics.
   */
  scrollBy: (dx: number, dy: number) => void;
};

const ALL_BOUNDS_FALSE: CardPreviewScrollBounds = {
  left: false,
  right: false,
  up: false,
  down: false,
};

const CardPreview = forwardRef<
  CardPreviewHandle,
  {
    template: CardTemplate;
    sampleEntity?: CardEntityPayload | null;
    maxWidthMm?: number;
    emptyMessage?: string;
    interactive?: boolean;
    selectedSlotId?: string | null;
    onSelectSlot?: (id: string | null) => void;
    onSlotsChange?: (next: CardTemplate['slots']) => void;
    /** Multiplier on top of the base fit-to-window scale. Must be > 0. */
    zoom?: number;
    /** Forwarded to {@link LiveSlotOverlay} so the parent can decide. */
    showLabels?: boolean;
    /**
     * Fires whenever the Paper's scroll bounds change (and once
     * synchronously after each mount / re-mount of the populated Paper,
     * and once with every direction `false` on unmount or target flip
     * back to null so the parent can lock down all four pan arrows
     * when there is no Paper to scroll). The callback runs from inside
     * a `useLayoutEffect`, so the parent can `setState` from it without
     * triggering a "state update during render" warning. Parents SHOULD
     * stabilise this with `useCallback(..., [])` so a fresh function
     * identity each render doesn't cause unnecessary churn upstream.
     */
    onScrollBoundsChange?: (bounds: CardPreviewScrollBounds) => void;
  }
>(function CardPreview(props, ref) {
  const {
    template,
    sampleEntity,
    maxWidthMm = 220,
    emptyMessage,
    interactive = false,
    selectedSlotId = null,
    onSelectSlot,
    onSlotsChange,
    zoom = 1,
    showLabels = false,
    onScrollBoundsChange,
  } = props;
  const { t } = useTranslation();
  const target = useMemo<CardEntityPayload | null>(() => {
    if (sampleEntity) return sampleEntity;
    if (template.slots.length === 0) return null;
    const firstField = template.slots.map((s) => s.binding?.fieldPath).find((p) => !!p);
    const kind: CardEntityPayload['kind'] = firstField?.startsWith('prerequisite')
      ? 'feat'
      : firstField?.startsWith('abilities') || firstField?.startsWith('armorClass') || firstField?.startsWith('hitPoints')
        ? 'monster'
        : firstField?.startsWith('className') || firstField?.startsWith('dexterity')
          ? 'character'
          : firstField?.startsWith('price')
            ? 'shop-item'
            : 'spell';
    return entityNormalisers[kind]({
      id: 'sample',
      name: t('cards_sample_name', 'Bola de fuego'),
      description: t('cards_sample_description', 'Una bola de fuego abrasadora estalla desde un punto a elección dentro del alcance, expandiéndose para llenar una esfera de 6 metros de radio...'),
      origin: 'manual',
      level: 3,
      school: 'Evocación',
      castingTime: '1 acción',
      range: '45 m',
      duration: 'Instantáneo',
      components: 'V, S, M',
    } as any);
  }, [sampleEntity, template.slots, t]);

  if (!target) {
    return (
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Stack alignItems="center" spacing={1}>
          <Typography variant="subtitle1" color="text.secondary">
            {emptyMessage ?? t('cards_preview_empty', 'Añade al menos un slot para ver la previsualización.')}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  // Single source of truth for the display scale. Combining the base
  // fit-to-window scale with the user zoom keeps the px→mm conversion in
  // LiveSlotOverlay's drag handlers automatically accurate: the overlay's
  // container ref is sized at the *final* on-screen dimensions.
  const pxScale = MM_TO_PX;
  const pxW = template.widthMm * pxScale;
  const pxH = template.heightMm * pxScale;
  const maxScreenPx = Math.max(160, maxWidthMm * pxScale); // never smaller than a thumb
  const fitScale = Math.min(1, maxScreenPx / pxW);
  // Defensive clamp so a stray `zoom = -2` doesn't flip the card.
  const safeZoom = Math.max(0.25, zoom);
  const displayScale = fitScale * safeZoom;

  // Refs to drive drag-to-pan. `paperRef` attaches to the Paper so we
  // can read / write `scrollLeft` / `scrollTop` while the user drags.
  // `panRef` carries the drag start state (origin cursor + initial
  // scroll position + captured pointer id) so the move/up handlers
  // don't need to recompute it on every frame.
  const paperRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    pointerId: number;
  } | null>(null);

  /**
   * Local mirror of the Paper's scroll bounds, used by the merged
   * layout-effect / imperative-handle path. The PARENT also gets
   * notified directly via `onScrollBoundsChange` so its own toolbar
   * re-renders on every scroll frame — the local state is mostly a
   * belt-and-suspenders copy retained so {@link useImperativeHandle}
   * (and any future internal consumer) can read the same truth
   * without having to re-thunk `paperRef.current` synchronously.
   *
   * Defaults are all `false` so a freshly-mounted Paper that ALREADY
   * happens to be at the boundary (e.g. the user just zoomed in at
   * 2.5× on a small column and the card now overflows on both axes)
   * shows every arrow correctly disabled from the very first paint;
   * `useLayoutEffect` runs the synchronous `compute()` BEFORE the
   * browser paints, so we never paint a stale "all enabled" frame.
   */
  const [canReachEdge, setCanReachEdge] = useState<CardPreviewScrollBounds>(ALL_BOUNDS_FALSE);

  /**
   * Stash the parent's `onScrollBoundsChange` in a ref so a fresh
   * function identity from the parent on every render doesn't drop our
   * pending RAF or force a re-attach of the scroll listener. We
   * refresh the ref by direct assignment on every render — that's the
   * standard React pattern for "stable ref to a fresh prop" and the
   * assignment runs inline, not in an effect, so it cannot race with
   * the layout-effect's callback fire order.
   */
  const onScrollBoundsChangeRef = useRef(onScrollBoundsChange);
  onScrollBoundsChangeRef.current = onScrollBoundsChange;

  /**
   * Mirror the Paper's scroll bounds into BOTH the local
   * `canReachEdge` `useState` AND the parent's `onScrollBoundsChange`
   * callback. Both fires happen inside the same `useLayoutEffect`
   * (rather than `useEffect`) so the layout-effect runs before the
   * browser paints — meaning consumers never see a single stale
   * "all arrows enabled" frame on first mount or after a target flip.
   *
   * The `scroll` listener is throttled with `requestAnimationFrame`:
   * a continuous drag-to-pan drops scroll events like rain, but at
   * most one `compute()` per 16 ms reaches the scheduler. React then
   * no-ops the `setCanReachEdge` call when the new tuple is equal to
   * the previous one (React skips structural-equal `useState` updates),
   * so a stationary Paper at full-canvas size short-circuits to zero
   * local re-renders even though the parent still gets notified on
   * each unique transition.
   *
   * `paper` is captured stably inside the effect via closure; React
   * updates `paperRef.current` to the new Paper synchronously between
   * commit and the layout-effect run, so when `target` flips
   * `paperRef.current` is already pointing at the new DOM node.
   */
  useLayoutEffect(() => {
    const paper = paperRef.current;
    if (!paper) return;
    const compute = () => {
      const next: CardPreviewScrollBounds = {
        left: paper.scrollLeft > 0.5,
        right: paper.scrollLeft + paper.clientWidth < paper.scrollWidth - 0.5,
        up: paper.scrollTop > 0.5,
        down: paper.scrollTop + paper.clientHeight < paper.scrollHeight - 0.5,
      };
      setCanReachEdge(next);
      onScrollBoundsChangeRef.current?.(next);
    };
    let rafId = 0;
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        compute();
      });
    };
    compute();
    paper.addEventListener('scroll', schedule, { passive: true });
    return () => {
      paper.removeEventListener('scroll', schedule);
      if (rafId) cancelAnimationFrame(rafId);
      // Inform the parent that the Paper is gone (target flipped back
      // to null, populated branch unmounted) so all four pan arrows
      // can disable themselves instead of remaining in whatever stale
      // state they last observed. Without this the user can briefly
      // see an enabled right-arrow on the now-empty Paper for the
      // duration of the next parent render.
      onScrollBoundsChangeRef.current?.(ALL_BOUNDS_FALSE);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, target !== null]);

  /**
   * Imperative handle exposed via `forwardRef` so the parent dialog's
   * toolbar can call `scrollBy(dx, dy)` programmatically. We forward
   * to the DOM `scrollBy` (smooth behaviour so the pan feels deliberate
   * rather than jittery); boundary clamping is automatic so the toolbar
   * buttons stay safe to call regardless of how far the user has
   * already panned.
   *
   * The drag-to-pan early-return (when `panRef.current` is set) keeps
   * the imperative button-press from racing against an active click-
   * and-drag gesture: if the user happens to tap one of the toolbar
   * arrow buttons while their other hand is mid-drag on the canvas,
   * `scrollBy` no-ops and the ongoing drag keeps owning the scroll
   * metrics. A bug here would otherwise be visible as a subtle jitter
   * mid-pan on touch tablets.
   *
   * We do NOT depend on `canReachEdge` here because the disabled
   * visual feedback is now driven by the parent via the
   * `onScrollBoundsChange` path. The handle's `scrollBy` doesn't need
   * any state to honour the boundary correctly — the DOM does.
   */
  useImperativeHandle(ref, () => ({
    scrollBy: (dx, dy) => {
      const paper = paperRef.current;
      if (!paper || panRef.current) return;
      paper.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
    },
  }), []);

  /**
   * Drag-to-pan: when zoom blows the card beyond the Paper's bounds the
   * `overflow: 'auto'` already exposed in the parent <Paper> gives us
   * native scrollbars / trackpad scrolling, but click-and-drag on empty
   * canvas (the Photoshop-style pan) wasn't reachable. We listen for
   * pointerdown / pointermove / pointerup directly on the Paper.
   *
   * Coexistence with {@link LiveSlotOverlay}:
   *   - Slot divs call `e.stopPropagation()` inside their own
   *     `onPointerDown` (via `startDrag`), so Paper-level listeners do
   *     NOT fire while a slot drag is in progress. The slot window-level
   *     pointermove listeners still tick but `LiveSlotOverlay`'s
   *     `dragState` is null in that case, so its onMove early-returns.
   *   - When the user pointerdowns on the empty canvas (the
   *     LiveSlotOverlay root), `LiveSlotOverlay`'s onPointerDown
   *     selects the base card but does NOT stop propagation, so the
   *     Paper pointerdown fires AFTER and pan takes over from the
   *     second pointer event onwards. The drag itself naturally cancels
   *     the selection (no harm done — the user was clearly trying to
   *     pan the canvas).
   *   - We only register when `interactive` is true because in
   *     headless previews (used by other dialogs like the printable
   *     grid) clicks should fall through to whatever the host has
   *     wired up.
   *
   * Cursor:
   *   - `grab` on the Paper padding — the only place Paper's cursor
   *     isn't overridden by descendants — so the user gets a hint on
   *     hover that they can pan.
   *   - `grabbing` set imperatively while dragging, then released so
   *     the Paper reverts to the default state for the next interaction.
   */
  useEffect(() => {
    const paper = paperRef.current;
    if (!paper || !interactive) return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // Don't restart a pan while one is already in flight. Multi-pointer
      // (touch + mouse, two touch points, stylus + touch) would otherwise
      // overwrite panRef.current without releasing the previous capture,
      // leaving a stranded `setPointerCapture` for the prior pointerId.
      // Only the first gesture is honoured; subsequent pointer events
      // fold into the ongoing drag via the move/up handlers.
      if (panRef.current) return;
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: paper.scrollLeft,
        scrollTop: paper.scrollTop,
        pointerId: e.pointerId,
      };
      try { paper.setPointerCapture(e.pointerId); } catch { /* not all browsers refuse but a failed capture still bubbles fine */ }
      paper.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      const st = panRef.current;
      if (!st || e.pointerId !== st.pointerId) return;
      paper.scrollLeft = st.scrollLeft - (e.clientX - st.startX);
      paper.scrollTop = st.scrollTop - (e.clientY - st.startY);
    };
    const onPointerUp = (e: PointerEvent) => {
      const st = panRef.current;
      if (!st || e.pointerId !== st.pointerId) return;
      try { paper.releasePointerCapture(e.pointerId); } catch { /* already released by browser (e.g. focus loss) */ }
      panRef.current = null;
      paper.style.cursor = '';
    };
    paper.addEventListener('pointerdown', onPointerDown);
    paper.addEventListener('pointermove', onPointerMove);
    paper.addEventListener('pointerup', onPointerUp);
    paper.addEventListener('pointercancel', onPointerUp);
    return () => {
      paper.removeEventListener('pointerdown', onPointerDown);
      paper.removeEventListener('pointermove', onPointerMove);
      paper.removeEventListener('pointerup', onPointerUp);
      paper.removeEventListener('pointercancel', onPointerUp);
      paper.style.cursor = '';
      // Drop any in-flight pan state so a mid-drag swap (interactive flip
      // or target reflow) doesn't leave panRef.current stranded and
      // block subsequent drags via the early-return in onPointerDown.
      panRef.current = null;
    };
    // `interactive` covers the obvious toggle; `target !== null` catches
    // the Paper's own remount when the entity flips between empty and
    // populated. A boolean dep is more robust than `target?.sourceId`
    // because it works regardless of whether `sourceId` happens to be
    // undefined, and Object.is comparison for booleans does the right
    // thing on flip (no re-run while staying in the same branch).
  }, [interactive, target !== null]);

  return (
    <Paper
      ref={paperRef}
      elevation={2}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.default' : 'grey.100',
        display: 'flex',
        // `safe center` keeps the card centred when it fits and falls back
        // to flex-start when it overflows — otherwise the user can't
        // scroll up to see the top of an enlarged card.
        justifyContent: 'safe center',
        alignItems: 'safe center',
        minHeight: 200,
        overflow: 'auto',
        // The Empty-canvas / padding cursor hint that the canvas is
        // pannable. `LiveSlotOverlay` overrides this inside the card
        // bounding box (where slot-level cursors take precedence), so
        // this only paints on the Paper's own padding when the inner
        // Box doesn't reach the Paper's edges.
        cursor: 'grab',
      }}
    >
      <Box sx={{ position: 'relative', width: pxW * displayScale, height: pxH * displayScale }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `scale(${displayScale})`,
            transformOrigin: 'top left',
            width: pxW,
            height: pxH,
          }}
        >
          <CardRenderer template={template} entity={target} />
          {interactive && onSelectSlot && onSlotsChange && (
            <LiveSlotOverlay
              template={template}
              selectedSlotId={selectedSlotId}
              onSelectSlot={onSelectSlot}
              onSlotsChange={onSlotsChange}
              showLabels={showLabels}
            />
          )}
        </Box>
      </Box>
    </Paper>
  );
});

export default CardPreview;
