#!/usr/bin/env python
# Limpia el </div> extra que mi script anterior dejó en el fast-path del DIVIDER.
# Estado previo:<br>
#   - fast-path wrapper: <div style=...> ... <rect/> ... </svg> </div>
#   - ahora tiene UN </div> extra que no debería estar
import sys

path = r'frontend/src/components/cards/CardRenderer.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

original_len = len(content)

# Eliminar el </div> extra en el fast-path del divisor.
# El bug: tras mi patch #1 el fast-path quedó correcto, pero patch #2 con rfind
# encontró un </svg> que corresponde al fast-path (NO al complex-path) y le
# añadió un </svg></div> extra. Eso añade un </div> sin abrir.
# Patrón a buscar: línea 309 "    </div>\n      </div>" (cierre extra) en el
# contexto del fast-path. Lo borramos manteniendo una sola </div>.

old_dup = (
    '          <rect x={rectX} y={rectY} width={rectW} height={rectH} fill={color} />\n'
    '        </svg>\n'
    '      </div>\n'
)
new_clean = (
    '          <rect x={rectX} y={rectY} width={rectW} height={rectH} fill={color} />\n'
    '        </svg>\n'
    '      </div>\n'
)
# If the file has the broken double </div>, the pattern there is:
# '...\n        </svg>\n      </div>\n    </div>\n' (or similar).
# Use the unique fast-path anchor with the extra </div>.
old_broken = (
    '          <rect x={rectX} y={rectY} width={rectW} height={rectH} fill={color} />\n'
    '        </svg>\n'
    '      </div>\n'
    '      </div>\n'
)
if old_broken in content:
    content = content.replace(old_broken, new_clean, 1)
    print('Removed extra </div> in fast-path.')
elif old_dup in content and content.count(old_dup) == 1:
    print('Fast-path already clean (single </div> after </svg>).')
else:
    # alt pattern - the rfind added a </svg></div> to the WRONG place.
    # Search for '      </svg>\n      </div>\n' which would be the doubled close.
    alt = '      </svg>\n      </div>\n'
    if alt in content:
        content = content.replace(alt, '      </svg>\n', 1)
        print('Removed extra </div> attached to a </svg> in fast-path.')
    else:
        sys.exit('ERROR: could not find broken pattern in fast-path')

# Verify counts now.
svg_count = content.count('</svg>')
div_open_count = content.count('<div style={dividerSlotStyle(slot)}')
div_close_in_divider = (
    content.count('      </div>\n    </div>') + content.count('        </svg>\n      </div>')
)
print(f'INFO: </svg> total = {svg_count}')
print(f'INFO: <div style={dividerSlotStyle(slot)}> opens = {div_open_count}')
print(f'INFO: closing patterns matching divider wrapper = {div_close_in_divider}')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Original length: {original_len}')
print(f'New length:      {len(content)}')
print(f'Total delta:     {len(content) - original_len} chars')
print('OK: fast-path </div> extra cleaned up.')
