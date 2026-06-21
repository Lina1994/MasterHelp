#!/usr/bin/env python
# Fix para el bug "los divisores no se renderizan al exportar a PDF o al imprimir".
# html2canvas v1.4.1 serializa el <svg> como imagen con data URI; los estilos
# aplicados directamente al <svg> (positioning absoluto + transform + mm en width/height)
# se pierden en la serialización (recurrente con mm + transform + preserveAspectRatio=none).
#
# Fix: el envoltorio <div> recibe `dividerSlotStyle(slot)` (que html2canvas
# lee bien). El <svg> interior pasa a width="100%"/height="100%" en ATRIBUTOS
# y display:block para evitar el gap inline-block. Las dimensiones se preservan
# porque la viewBox + preserveAspectRatio="none" estiran el contenido al tamaño
# del padre (establecido por el <div> en mm).
import sys

path = r'frontend/src/components/cards/CardRenderer.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

original_len = len(content)

# 1) Fast-path (effect === 'plain' && curveMm === 0 && endTaperMm === 0):
old1 = (
    '      <svg style={dividerSlotStyle(slot)} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">\n'
    '        <rect x={rectX} y={rectY} width={rectW} height={rectH} fill={color} />\n'
    '      </svg>\n'
)
new1 = (
    '      <div style={dividerSlotStyle(slot)}>\n'
    '        <svg\n'
    '          width="100%"\n'
    '          height="100%"\n'
    '          style={{ display: \'block\' }}\n'
    '          viewBox={`0 0 ${w} ${h}`}\n'
    '          preserveAspectRatio="none"\n'
    '        >\n'
    '          <rect x={rectX} y={rectY} width={rectW} height={rectH} fill={color} />\n'
    '        </svg>\n'
    '      </div>\n'
)
if old1 not in content: sys.exit('ERROR: old1 anchor not found (fast-path rect SVG)')
content = content.replace(old1, new1, 1)

# 2) Wrap the SECOND <svg> (the complex path return in DividerShape) in a <div>.
# Use a much larger unique block: from the second <svg> opening through to the
# closing </svg></div></pre> so the anchor includes enough context to disambiguate.
# We replace the <svg> opening tag with the wrapper, AND we replace the
# matching closing </svg> with </svg></div>.
#
# To avoid ambiguity we work on the second <svg>: count remaining <svg> occurrences
# after patch #1 and pick the one that introduces the complex path return.
remaining_count = content.count('<svg style={dividerSlotStyle(slot)}')
if remaining_count != 1:
    sys.exit(f'ERROR: expected exactly 1 remaining <svg style=...> after path 1, got {remaining_count}')

# Locate the second <svg> opening.
open_pos = content.find('<svg style={dividerSlotStyle(slot)} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">')
if open_pos < 0:
    sys.exit('ERROR: could not locate remaining <svg> opening after patch 1')

# Find the matching closing </svg> by counting balance from the open. SVG is not
# nested in this renderer, so a naive next-</svg> works — but we have to handle
# case where there might be self-closing or nested tags inside the band path.
# We use a simple lookahead: the next occurrence of '</svg>' after open_pos.
close_pos = content.find('</svg>', open_pos)
if close_pos < 0 or close_pos == open_pos:
    sys.exit('ERROR: could not locate matching </svg> after wrap open')

# Confirm the close line is the one for this block (only one </svg> AFTER
# all the path/poly data).  Read the next 30 chars for sanity: should be '\n'
# or '    );' (function close) afterwards.
trailer = content[close_pos+len('</svg>'):close_pos+len('</svg>')+30]

# Replace the opening tag.
old_open = (
    '    <svg style={dividerSlotStyle(slot)} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">\n'
)
new_open = (
    '    <div style={dividerSlotStyle(slot)}>\n'
    '      <svg\n'
    '        width="100%"\n'
    '        height="100%"\n'
    '        style={{ display: \'block\' }}\n'
    '        viewBox={`0 0 ${w} ${h}`}\n'
    '        preserveAspectRatio="none"\n'
    '      >\n'
)
if old_open not in content:
    sys.exit('ERROR: complex-path <svg> opening anchor not found exactly')
content = content.replace(old_open, new_open, 1)

# Replace the closing </svg> with </svg></div>. Preserve indentation: the
# original line was `      </svg>\n` (6 spaces). The new `</svg>` keeps the
# same 6-space indent; `</div>` adds at 4-space indent matching the wrapper.
old_close = '      </svg>\n'
# After the previous replacements there might still be more than one match,
# so we use rsplit-style strategy: locate the LAST occurrence before the
# function's closing return — i.e. the one in DividerShape.
last_close = content.rfind(old_close)
if last_close < 0:
    sys.exit('ERROR: could not locate the </svg> closing tag in DividerShape')
new_close = '      </svg>\n    </div>\n'
# Apply the replacement at the SAME final position so other </svg>s elsewhere
# are untouched.
content = content[:last_close] + new_close + content[last_close+len(old_close):]

# Sanity check: at this point the ONLY </svg> -> </div> pair should be the
# one we added (any earlier </svg> tags in the file should still exist for
# other components like IMAGE slot icons etc.).
svg_close_count = content.count('</svg>')
div_close_count = content.count('</div>\n    );')
print(f'INFO: </svg> occurrences after fix: {svg_close_count}')
print(f'INFO: </div> close markers in DividerShape pattern: {div_close_count}')
print(f'INFO: trailer at close was: {trailer!r}')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Original length: {original_len}')
print(f'New length:      {len(content)}')
print(f'Total delta:     {len(content) - original_len} chars')
print('OK: divider SVG fix applied (fast-path + final-path wrapped in <div>).')
