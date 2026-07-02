import docx, json, sys, re

d = docx.Document('MasterHelp.docx')

# Dump the entire doc as plain text, marked up with style names, so we can see the outline
out = []
for i, p in enumerate(d.paragraphs):
    style = p.style.name if p.style else ''
    text = p.text
    out.append({'i': i, 'style': style, 'text': text})

with open('tmp_docx_dump.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

# Also print compactly: only headings + first text-line of each heading
print('=== HEADINGS + FIRST PARAGRAPH UNDERNEATH ===')
last_h1_idx = None
sections = {1: [], 2: [], 3: []}
current_section = []
prev_was_heading_of = None

for j, p in enumerate(out):
    s = p['style']
    t = p['text']
    if s == 'Heading 1':
        sections[1].append((j, t))
    elif s == 'Heading 2':
        sections[2].append((j, t))
    elif s == 'Heading 3':
        sections[3].append((j, t))

print('\n-- H1 --')
for i, t in sections[1]:
    print(f'  {i:3d}  {t}')
print('-- H2 --')
for i, t in sections[2]:
    print(f'  {i:3d}  {t}')
print('-- H3 --')
for i, t in sections[3]:
    print(f'  {i:3d}  {t}')

# Quick word freq
all_text = ' '.join(p['text'] for p in out)
print('\nTOTAL CHARS:', len(all_text))
print('TOTAL WORDS:', len(all_text.split()))
