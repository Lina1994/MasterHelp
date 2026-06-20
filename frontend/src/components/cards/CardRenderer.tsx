import { createRoot, type Root } from 'react-dom/client';
import { useEffect, useMemo, useRef } from 'react';
import type { CardEntityPayload, CardSlot, CardTemplate } from '../../types/cardTemplates';
import { renderSlotValue, resolveCardPath } from '../../utils/cardSlotResolver';

/**
 * Builds the CSS transform string for a slot's rotational+flip authoring
 * state. Kept axis-aligned on the slot's bounding box (the transform sits
 * INSIDE the box, around its centre) so the LiveSlotOverlay's drag clamps
 * — which read the box's screen-space rect — stay correct without
 * compensating for transforms. Rotation and flips here MUST match the
 * transform applied to the LABEL inside LiveSlotOverlay, otherwise the
 * label will visually drift away from the slot when the user tilts it.
 *
 * Exported so {@link LiveSlotOverlay} can apply the exact same transform
 * to its label badge. Stay byte-identical between the two files or the
 * label will visually drift away from the content.
 */
export function slotTransform(slot: CardSlot): string {
  const parts: string[] = [];
  if (slot.flipH) parts.push('scaleX(-1)');
  if (slot.flipV) parts.push('scaleY(-1)');
  if (typeof slot.rotation === 'number' && Math.abs(slot.rotation) > 0.01) {
    parts.push(`rotate(${slot.rotation}deg)`);
  }
  return parts.length ? parts.join(' ') : 'none';
}

/**
 * Builds the inline CSS style object for a slot based on its stored
 * CardSlotStyle. Unit conversion: positions are already mm, padding too;
 * font sizes are interpreted as pt for predictability on print.
 */
function slotStyle(slot: CardSlot): React.CSSProperties {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${slot.position.x}mm`,
    top: `${slot.position.y}mm`,
    width: `${slot.position.w}mm`,
    height: `${slot.position.h}mm`,
    boxSizing: 'border-box',
    overflow: 'hidden',
    padding: `${slot.style.paddingMm ?? 0}mm`,
  };
  if (slot.style.backgroundColor) style.backgroundColor = slot.style.backgroundColor;
  if (slot.style.color) style.color = slot.style.color;
  if (slot.style.fontSize) style.fontSize = `${slot.style.fontSize}pt`;
  if (slot.style.fontWeight) style.fontWeight = (slot.style.fontWeight as any);
  // Per-slot typography. The slot's `fontFamily` overrides the template
  // global font so two text fields on the same card can read in any
  // typeface combination the author chooses. fontStyle (italic) and
  // textDecoration (underline / line-through / both) are CSS-equivalent
  //                        values and inherit naturally down to the
  //                        text-bearing inner elements since we don't set
  //                        them again inside SlotBody.
  if (slot.style.fontFamily) style.fontFamily = slot.style.fontFamily;
  if (slot.style.fontStyle && slot.style.fontStyle !== 'normal') style.fontStyle = slot.style.fontStyle;
  if (slot.style.textDecoration && slot.style.textDecoration !== 'none') style.textDecoration = slot.style.textDecoration;
  if (slot.style.textAlign) style.textAlign = slot.style.textAlign;
  // The FRAME slot draws its own concentric borders inside the
  // `FrameSlot` component (an outer band plus an inner accent ring).
  // Adding the wrapper border on top created a third visible band that
  // didn't recolour alongside the others when the panel's "Color borde"
  // picker fired — the bug reported on the starter templates where the
  // visible frame looked like "three parts" and only the outermost
  // followed the colour picker. Suppressing it for `FRAME` keeps every
  // visible ring driven by a single field of `FrameSlot`.
  if (slot.type !== 'FRAME' && slot.style.borderColor && slot.style.borderWidth) {
    style.border = `${slot.style.borderWidth}mm solid ${slot.style.borderColor}`;
  }
  if (typeof slot.style.borderRadius === 'number') {
    style.borderRadius = `${slot.style.borderRadius}mm`;
  }
  // Authoring rotation / flip for the rendered slot content. The
  // transform is applied AROUND THE BOX'S CENTRE (`transformOrigin:
  // 'center center'`) so the bounding box stays axis-aligned: the
  // LiveSlotOverlay layer, whose drag handlers compute `pxPerMm` from
  // the box's getBoundingClientRect, continues to work without any
  // compensation for transforms. `objectFit` is intentionally NOT set
  // here — the IMAGE `<img>` element in SlotBody reads it directly.
  style.transform = slotTransform(slot);
  style.transformOrigin = 'center center';
  return style;
}

/**
 * Decorative frame slot. We render an inner rectangle with the chosen
 * border colour and, when there's room, four tiny notches at the corners
 * to give the classic TTRPG card look (mtg/d&d vintage frames). The slot
 * itself can carry a label via the standard binding pipeline.
 */
function FrameSlot({ slot, entity }: { slot: CardSlot; entity: CardEntityPayload }) {
  // Border colour drives every visible ring of the FRAME — the outer
  // band and the inner accent. We deliberately prefer `borderColor` over
  // `color` here because the slot properties panel exposes only the
  // "Color borde" picker (no separate "Frame colour"), so this is the
  // field the user actually edits. We use `||` (not `??`) so an empty
  // string still falls through to the legacy `color` field — protects
  // against hand-edited templates resetting the colour to '' on save.
  const color = slot.style.borderColor || slot.style.color || '#3b2a1a';
  const thickness = slot.style.borderWidth ?? 0.4;
  const radius = typeof slot.style.borderRadius === 'number' ? slot.style.borderRadius : 1.2;
  const label = slot.binding.isStatic ? slot.binding.fallbackText ?? '' : renderSlotValue(slot.binding, entity.data);
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          // `box-sizing: border-box` keeps the band's thickness inside the
          // `inset: 0` rect so the full `thickness` value is visible inside
          // the slot. With the CSS default (content-box) the border would
          // extend outward and the wrapper's `overflow: hidden` would clip
          // roughly half the ring, making a 2.5mm border read as ≈1.25mm.
          boxSizing: 'border-box',
          border: `${thickness}mm solid ${color}`,
          borderRadius: `${radius}mm`,
        }}
      />
      {/* Inner accent ring for vintage look */}
      <div
        style={{
          position: 'absolute',
          inset: `${Math.max(1, thickness * 1.5)}mm`,
          boxSizing: 'border-box',
          border: `${Math.max(0.2, thickness * 0.6)}mm solid ${color}`,
          opacity: 0.55,
          borderRadius: `${Math.max(0, radius - thickness * 0.8)}mm`,
        }}
      />
      {label ? (
        <div
          style={{
            position: 'absolute',
            top: '0.6mm',
            left: '0.6mm',
            right: '0.6mm',
            color,
            fontSize: `${slot.style.fontSize ?? 6}pt`,
            fontWeight: slot.style.fontWeight ?? 600,
            textAlign: slot.style.textAlign ?? 'left',
            lineHeight: 1.05,
            // Allow labels on small frames to wrap instead of overflowing
            // the slot's box or being clipped to ellipsis.
            whiteSpace: 'normal',
            overflow: 'hidden',
            pointerEvents: 'auto',
            // `textDecoration` on the inner label rather than the slot
            // wrapper so the underline / strikethrough only rides the
            // glyphs themselves, not any leftover inline whitespace.
            textDecoration: slot.style.textDecoration && slot.style.textDecoration !== 'none'
              ? slot.style.textDecoration
              : undefined,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Pill / chip "badge" slot. Renders a rounded chip with optional accent
 * background. The chip auto-fits its content but is constrained to the
 * slot's box so templates can lay out a row of tags.
 */
function BadgeSlot({ slot, entity }: { slot: CardSlot; entity: CardEntityPayload }) {
  const text = slot.binding.isStatic ? slot.binding.fallbackText ?? '' : renderSlotValue(slot.binding, entity.data);
  const color = slot.style.color ?? '#1b1b1b';
  const bg = slot.style.backgroundColor ?? 'rgba(0,0,0,0.08)';
  const radius = typeof slot.style.borderRadius === 'number' ? slot.style.borderRadius : 1.5;
  // `textDecoration` is declared explicitly on the inner span because the
  // outer flex wrapper only carries text along its centred line — relying
  // on CSS inheritance here would still stroke the unused horizontal
  // padding if the chip is wider than its visible glyphs. Keeping it on
  // the actual text node means underlines/strikes only show on glyphs.
  const textDecoration = slot.style.textDecoration && slot.style.textDecoration !== 'none'
    ? slot.style.textDecoration
    : undefined;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: slot.style.textAlign === 'right'
          ? 'flex-end'
          : slot.style.textAlign === 'center'
            ? 'center'
            : 'flex-start',
      }}
    >
      {text ? (
        <span
          style={{
            display: 'inline-block',
            padding: `0.4mm ${Math.max(1, radius * 0.8)}mm`,
            backgroundColor: bg,
            color,
            fontSize: `${slot.style.fontSize ?? 7}pt`,
            fontWeight: slot.style.fontWeight ?? 700,
            lineHeight: 1.05,
            borderRadius: `${radius}mm`,
            border: slot.style.borderColor && slot.style.borderWidth
              ? `${slot.style.borderWidth}mm solid ${slot.style.borderColor}`
              : `0.15mm solid rgba(0,0,0,0.15)`,
            maxWidth: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textTransform: slot.binding.formatString ? undefined : 'none',
            textDecoration,
          }}
        >
          {text}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Renders the body of a single slot. We use a render-prop approach so the
 * same renderer works for React and imperative (jspdf export) callers when
 * mounted via {@link renderCardTemplateToElement}.
 */
function SlotBody({
  slot,
  entity,
}: { slot: CardSlot; entity: CardEntityPayload }) {
  const value = renderSlotValue(slot.binding, entity.data as Record<string, unknown>);

  if (slot.type === 'FRAME') {
    return <FrameSlot slot={slot} entity={entity} />;
  }

  if (slot.type === 'BADGE') {
    return <BadgeSlot slot={slot} entity={entity} />;
  }

  if (slot.type === 'DIVIDER') {
    const orientation = slot.dividerConfig?.orientation ?? 'horizontal';
    const thickness = slot.dividerConfig?.thickness ?? 0.3;
    return (
      <div
        style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: orientation === 'horizontal' ? '100%' : `${thickness}mm`,
            height: orientation === 'horizontal' ? `${thickness}mm` : '100%',
            background: slot.style.color ?? '#888',
          }}
        />
      </div>
    );
  }

  if (slot.type === 'IMAGE') {
    const src = typeof value === 'string' && value.length > 0 ? value : '';
    // `objectFit` lives on the <img> itself (parent <div>s don't honour
    // it). We default to 'contain' so uploaded crests aren't aggressively
    // cropped by 'cover' on small surfaces — same default used in
    // {@link makeDefaultSlot} for new IMAGE slots.
    return (
      <img
        src={src}
        alt={slot.name}
        style={{
          width: '100%',
          height: '100%',
          display: src ? 'block' : 'none',
          objectFit: slot.style.objectFit ?? 'contain',
        }}
      />
    );
  }

  if (slot.type === 'KEY_VALUE_LIST') {
    const cfg = slot.keyValueConfig ?? {};
    const raw = resolveCardPath(entity.data, slot.binding.fieldPath ?? '');
    if (!Array.isArray(raw)) return <span style={{ fontSize: '0.7em', opacity: 0.6 }}>{value || '—'}</span>;
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', width: '100%' }}>
        {raw.map((pair, idx) => {
          if (cfg.isTupleArray && Array.isArray(pair)) {
            return (
              <li key={idx} style={{ display: 'flex', gap: '1mm', fontSize: '0.85em' }}>
                {cfg.showLabel && <strong>{String(pair[0] ?? '')}:</strong>}
                <span>{String(pair[1] ?? '')}</span>
              </li>
            );
          }
          return (
            <li key={idx} style={{ fontSize: '0.85em' }}>
              {String(pair ?? '')}
            </li>
          );
        })}
      </ul>
    );
  }

  if (slot.type === 'TEXT_MULTI') {
    return (
      <div style={{ width: '100%', height: '100%', whiteSpace: 'pre-wrap', overflow: 'hidden' }}>
        {value}
      </div>
    );
  }

  // TEXT_SINGLE default.
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: slot.style.textAlign === 'right' ? 'flex-end' : slot.style.textAlign === 'center' ? 'center' : 'flex-start', overflow: 'hidden' }}>
      <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{value}</span>
    </div>
  );
}

/**
 * Inner React renderer. Exposed as the React-friendly component used by the
 * editor preview and the printable page.
 */
function CardSurface({
  template,
  entity,
}: { template: CardTemplate; entity: CardEntityPayload }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const widthMm = template.widthMm;
  const heightMm = template.heightMm;
  const outer = useMemo<React.CSSProperties>(() => ({
    position: 'relative',
    width: `${widthMm}mm`,
    height: `${heightMm}mm`,
    background: template.globalStyle?.backgroundColor ?? 'white',
    color: template.globalStyle?.textColor ?? 'black',
    fontFamily: template.globalStyle?.fontFamily ?? 'system-ui, sans-serif',
    border: template.globalStyle?.borderWidthMm
      ? `${template.globalStyle.borderWidthMm}mm solid ${template.globalStyle.borderColor ?? '#000'}`
      : undefined,
    boxSizing: 'border-box',
    overflow: 'hidden',
    backgroundImage: template.globalStyle?.backgroundImageUrl
      ? `url(${template.globalStyle.backgroundImageUrl})`
      : undefined,
    backgroundSize: 'cover',
  }), [template, widthMm, heightMm]);

  useEffect(() => {
    surfaceRef.current?.style.setProperty('color', template.globalStyle?.textColor ?? 'black');
  }, [template.globalStyle?.textColor]);

  return (
    <div ref={surfaceRef} className="card-template-surface" style={outer}>
      {template.slots.map((slot) => (
        <div key={slot.id} style={slotStyle(slot)}>
          <SlotBody slot={slot} entity={entity} />
        </div>
      ))}
    </div>
  );
}

/**
 * Imperatively mount a template into a detached DOM element. Used by the
 * PDF export pipeline (jsPDF + html2canvas) so we can keep the React render
 * path identical to the on-screen preview.
 */
export function renderCardTemplateToElement(
  targetEl: HTMLElement,
  template: CardTemplate,
  entity: CardEntityPayload,
): Root {
  const root = createRoot(targetEl);
  root.render(<CardSurface template={template} entity={entity} />);
  return root;
}

/**
 * Public React component used by the editor preview / character generator
 * dialog. Renders the card at its natural mm size; callers wrap it in any
 * scaling container they want (we no longer wrap in a `transform: scale`
 * internally so consumers have full control).
 */
export default function CardRenderer({
  template,
  entity,
}: {
  template: CardTemplate;
  entity: CardEntityPayload;
}) {
  return (
    <div className="card-renderer-root">
      <CardSurface template={template} entity={entity} />
    </div>
  );
}
