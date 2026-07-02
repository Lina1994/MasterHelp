#!/usr/bin/env python3
"""Quick sanity test: column-aware extraction on 5 pages.

We expect each creature's name to appear as a STANDALONE line (no
inter-column interleaving) in the order they appear reading the PDF.
"""
import sys, pathlib
sys.path.insert(0, 'scripts')

import pdfplumber
from parse_es_srd import extract_page_text_column_aware

ROOT = pathlib.Path('data/manuals/dnd5e-2024')
PDF = ROOT / 'raw-sources' / 'SP_SRD_CC_v5.2.1.pdf'

OUT = pathlib.Path('tmp_srd_pages')
OUT.mkdir(exist_ok=True)

# (page_in_pdf, expected_first_creature, label)
SAMPLES = [
    (344, 'Kraken', 'liche_context'),
    (372, 'Tumulario', 'vampire_context'),
    (361, 'Plebeyo', 'quasit_context'),
    (285, 'Asesino', 'balor_context'),
    (350, 'Merrow', 'mummy_context'),
]

with pdfplumber.open(PDF) as pdf:
    for pg, expected_first, label in SAMPLES:
        text = extract_page_text_column_aware(pdf.pages[pg-1])
        (OUT / f'{label}_fixed.txt').write_text(text, encoding='utf-8')

        # Find first 20 STANDALONE creature-name lines.
        seen = []
        for ln in text.split('\n'):
            s = ln.strip()
            if not s:
                continue
            # Standalone = a short single token (likely a creature name).
            if s == s.title() and 3 <= len(s) <= 30:
                if any(c in s for c in 'ÁÉÍÓÚÑáéíóúñ') or s in {
                    'Liche', 'Vampiro', 'Quasit', 'Balor', 'Momia',
                    'Kraken', 'Lamia', 'Lémur', 'Lacero', 'Tumulario',
                    'Unicornio', 'Plebe',
                }:
                    seen.append(s)
            if len(seen) >= 15:
                break

        print(f'\n=== p{pg} ({label}): expected_first={expected_first!r} ===')
        # First 10 non-empty lines
        lines = [l for l in text.split('\n') if l.strip()]
        print('-- first 15 non-empty lines:')
        for ln in lines[:15]:
            print(f'   {ln[:100]!r}')
        print(f'-- standalone creature-name-like lines detected: {seen[:10]}')
