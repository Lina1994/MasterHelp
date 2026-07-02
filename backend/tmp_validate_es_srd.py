#!/usr/bin/env python3
"""End-to-end validation gate for parse_es_srd.py + ES files."""
import json
import pathlib
import re
import subprocess
import sys


ROOT = pathlib.Path('data/manuals/dnd5e-2024')
ES_DIR = ROOT / 'monsters' / 'es'
EN_DIR = ROOT / 'monsters' / 'en'
SCRIPT = pathlib.Path('scripts/parse_es_srd.py')

# ----- 1. AST check ----------------------------------------------------------
try:
    subprocess.run([sys.executable, '-c',
        'import ast; ast.parse(open(r"' + str(SCRIPT) + '", encoding="utf-8").read()); print("[1/4] AST OK")'],
        check=True, shell=False)
except subprocess.CalledProcessError as e:
    print("[FAIL] AST parse error:", e)
    sys.exit(2)

# ----- 2. Run preflight ----------------------------------------------------
print("[2/4] Preflight (no writes):")
r = subprocess.run([sys.executable, str(SCRIPT), '--preflight',
                    '--report-path', str(ROOT / 'scripts' / 'es_coverage_v8.json')],
                   capture_output=True, text=True)
print(r.stdout[-1000:])
if r.returncode != 0:
    print("[FAIL] preflight:", r.stderr); sys.exit(3)

# ----- 3. Run --restamp ingest ---------------------------------------------
print("[3/4] --restamp ingest (writes OFFICIAL_STAMP files):")
r = subprocess.run([sys.executable, str(SCRIPT), '--restamp'],
                   capture_output=True, text=True)
print(r.stdout[-2500:])
if r.returncode != 0:
    print("[FAIL] restamp:", r.stderr); sys.exit(4)

# ----- 4. End-to-end validation --------------------------------------------
print("[4/4] End-to-end validation:")

en_files = sorted(EN_DIR.glob('*.json'))
es_files = sorted(ES_DIR.glob('*.json'))
print(f'  EN files: {len(en_files)}, ES files: {len(es_files)}')

en_ids, es_ids = set(), set()
en_to_es = {}
for fp in en_files:
    d = json.load(open(fp, encoding='utf-8'))
    en_ids.add(d.get('id') or fp.stem)
    en_to_es[fp.stem] = d.get('id') or fp.stem
for fp in es_files:
    d = json.load(open(fp, encoding='utf-8'))
    es_ids.add(d.get('id') or fp.stem)

bi_sym = en_ids == es_ids
print(f'  Bi-sym (EN == ES at ID level): {"PASS" if bi_sym else "FAIL"} '
      f'(EN={len(en_ids)}, ES={len(es_ids)})')

# Source distribution in ES
from collections import Counter
src_dist = Counter()
official_count = 0
official_with_actions = 0
official_with_traits = 0
official_with_legendary = 0
schema_breaks = []
for fp in es_files:
    d = json.load(open(fp, encoding='utf-8'))
    src_dist[d.get('source', '?')] += 1
    if d.get('source') == 'SRD 5.2 castellano (Wizards)':
        official_count += 1
        if isinstance(d.get('actions'), list) and len(d['actions']) > 0:
            official_with_actions += 1
        if isinstance(d.get('traits'), list) and len(d['traits']) > 0:
            official_with_traits += 1
        if isinstance(d.get('legendaryActions'), list) and len(d['legendaryActions']) > 0:
            official_with_legendary += 1
        # Schema invariants: required fields
        for fk in ('id','slug','lang','source','name'):
            if not d.get(fk):
                schema_breaks.append((fp.stem, fk))
        # Trait/action entry shape
        for sect in ('traits','actions','legendaryActions'):
            for entry in (d.get(sect) or []):
                if not (isinstance(entry, dict) and 'name' in entry and 'text' in entry):
                    schema_breaks.append((fp.stem, f'{sect}-entry-shape'))
                    break

print(f'  Source distribution: {dict(src_dist)}')
print(f'  Official-stamped (Wizards): {official_count}')
print(f'    Of which with actions[] >= 1: {official_with_actions}')
print(f'    Of which with traits[] >= 1: {official_with_traits}')
print(f'    Of which with legendaryActions[] >= 1: {official_with_legendary}')

# Leak check (Spanish keywords in EN files)
leak_count = 0
for fp in en_files:
    s = fp.read_text(encoding='utf-8')
    for kw in ('Clase de Armadura', 'Puntos de Golpe', 'Atributos', 'Acciones legendarias'):
        if kw in s:
            leak_count += 1; break
print(f'  Spanish entries leaked into EN files: {leak_count}')

print(f'  Schema-break issues: {len(schema_breaks)}')
if schema_breaks[:5]:
    for fp_stem, key in schema_breaks[:5]:
        print(f'    {fp_stem}: missing/invalid "{key}"')

# Summary
print()
print('SUMMARY:')
print(f'  End-to-end PASS = {bi_sym and leak_count == 0 and len(schema_breaks) == 0}')
print(f'  Bi-sym: {bi_sym}, leak-free: {leak_count == 0}, schema-clean: {len(schema_breaks) == 0}')

# Quick spot-check: print one OFFICIAL_STAMP file's section arrays
import os
lich_path = ES_DIR / 'lich.json'
if lich_path.exists():
    lich = json.load(open(lich_path, encoding='utf-8'))
    print(f'\nLicht span check ({lich_path}):')
    print(f'  source = {lich.get("source")!r}')
    print(f'  hitPoints = {lich.get("hitPoints")}')
    print(f'  speed = {lich.get("speed")}')
    print(f'  abilities = {lich.get("abilities")}')
    print(f'  traits count = {len(lich.get("traits") or [])}')
    print(f'  actions count = {len(lich.get("actions") or [])}')
    print(f'  legendaryActions count = {len(lich.get("legendaryActions") or [])}')
    if lich.get('traits'):
        print(f'  first trait: {lich["traits"][0]}')
    if lich.get('actions'):
        print(f'  first action: {lich["actions"][0]}')
    if lich.get('legendaryActions'):
        print(f'  first legendary: {lich["legendaryActions"][0]}')
