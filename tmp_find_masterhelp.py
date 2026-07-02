import os, sys

# 1) Find candidate MasterHelp.* files anywhere in the project (skip .git / node_modules)
SKIP = ('./.git', './node_modules', './frontend/node_modules', './backend/node_modules', './dist', './release')
candidates = []
for root, _, files in os.walk('.'):
    rnorm = root.replace('\\', '/')
    if any(rnorm.startswith(s) for s in SKIP):
        continue
    for f in files:
        low = f.lower()
        if 'masterhelp' in low or ('master' in low and low.endswith('.docx')):
            full = os.path.join(root, f)
            candidates.append((full, os.path.getsize(full)))

print('== Candidate MasterHelp files ==')
for p, sz in candidates:
    print(f'  {p}  ({sz} bytes)')

# 2) List docs/ folder
print('\n== docs/ folder ==')
docs_dir = 'docs'
if os.path.isdir(docs_dir):
    for f in sorted(os.listdir(docs_dir)):
        p = os.path.join(docs_dir, f)
        if os.path.isfile(p):
            print(f'  {f}  ({os.path.getsize(p)} bytes)')

# 3) Check python-docx
try:
    import docx  # noqa: F401
    print('\npython-docx: INSTALLED')
    import docx
    print('  version:', getattr(docx, '__version__', 'n/a'))
except ImportError as e:
    print('\npython-docx: NOT INSTALLED (will try to install)')
    import subprocess
    res = subprocess.run([sys.executable, '-m', 'pip', 'install', '--quiet', 'python-docx'],
                         capture_output=True, text=True)
    print('install rc:', res.returncode)
    print('install stderr:', res.stderr[-300:] if res.stderr else '(empty)')
    try:
        import docx
        print('post-install: INSTALLED, version:', getattr(docx, '__version__', 'n/a'))
    except ImportError:
        print('post-install: STILL NOT INSTALLED')
