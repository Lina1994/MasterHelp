import { rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { MonstersRepository } from './monsters.repository';

/**
 * Regression test for the ES + dnd5e-2024 bestiary.
 *
 * Bug history: 208 of 362 es/*.json stub files have `name: null`.
 * The auto-build path in readIndex() used to call
 *   `items.sort((a, b) => a.name.localeCompare(b.name))`
 * which throws TypeError on the first null. The outer try/catch silently
 * swallowed it, falling through to the monolítico fallback which returned
 * [], so the frontend showed "No se encontraron monstruos".
 *
 * Fix:
 *   - items.push now uses `safeName = detail.name ?? detail.slug ?? ...`
 *   - sort comparator hardened to `(a?.name ?? '').localeCompare(b?.name ?? '')`
 *   - list()'s enrich-map rebuild preserves `source` so the pendiente
 *     badge survives on items re-loaded from the detail path.
 *
 * The test does NOT depend on a running database.
 */
describe('MonstersRepository - ES auto-build regression', () => {
  const tmpRoot = resolve(__dirname, '_tmp_repo_test');

  beforeAll(() => {
    // Mirror the production directory structure
    const monstersDir = join(tmpRoot, 'data', 'manuals', 'dnd5e-test', 'monsters');
    const esDir = join(monstersDir, 'es');
    mkdirSync(esDir, { recursive: true });

    // Translated entry (no null name)
    writeFileSync(
      join(esDir, 'zombie.json'),
      JSON.stringify({
        id: 'zombie',
        slug: 'zombie',
        lang: 'es',
        source: 'SRD 5.2 castellano (Wizards)',
        name: 'Zombi',
        type: 'Muerto viviente',
        size: 'Mediano',
        alignment: 'neutral malvado',
        armorClass: { value: 8 },
        hitPoints: { average: 15, roll: '2d8 + 6' },
        abilities: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
        challengeRating: '1/4',
      }),
    );

    // Stub with name: null (currently 208 of 362 production files are like this)
    writeFileSync(
      join(esDir, 'acolyte.json'),
      JSON.stringify({
        id: 'acolyte',
        slug: 'acolyte',
        lang: 'es',
        source: 'SRD 5.2 castellano (pendiente)',
        name: null,
        size: null,
        type: null,
        alignment: null,
        armorClass: null,
        hitPoints: null,
        abilities: null,
        challengeRating: null,
      }),
    );
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('survives null name entries (no TypeError on sort)', () => {
    const repo = new MonstersRepository();
    const originalCwd = process.cwd();
    process.chdir(tmpRoot);
    try {
      const items = repo.list('es', 'dnd5e-test');
      expect(items.length).toBe(2);
      expect(items.every((it) => typeof it.name === 'string')).toBe(true);
      const slugs = items.map((it) => it.slug).sort();
      expect(slugs).toContain('acolyte');
      expect(slugs).toContain('zombie');
      // The stub should fall back to its slug as name
      const acolyte = items.find((it) => it.slug === 'acolyte')!;
      expect(acolyte.name).toBe('acolyte');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('regression: detail-path (get) works for stub & translated entries', () => {
    const repo = new MonstersRepository();
    const originalCwd = process.cwd();
    process.chdir(tmpRoot);
    try {
      const zombie = repo.get('es', 'zombie', 'dnd5e-test');
      expect(zombie).not.toBeNull();
      expect(zombie?.name).toBe('Zombi');
      expect(zombie?.lang).toBe('es');
      expect((zombie as any)?.source).toBe('SRD 5.2 castellano (Wizards)');

      const acolyte = repo.get('es', 'acolyte', 'dnd5e-test');
      expect(acolyte).not.toBeNull();
      // stub keeps its slug-derived name and source sentinel
      expect(acolyte?.slug).toBe('acolyte');
      expect(acolyte?.name).toBe('acolyte');
      expect((acolyte as any)?.source).toBe('SRD 5.2 castellano (pendiente)');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('regression: list() enrich-map preserves `source` so pendiente badge survives', () => {
    const repo = new MonstersRepository();
    const originalCwd = process.cwd();
    process.chdir(tmpRoot);
    try {
      const items = repo.list('es', 'dnd5e-test');
      const acolyte = items.find((it) => it.slug === 'acolyte');
      const zombie = items.find((it) => it.slug === 'zombie');
      expect(acolyte?.source).toBe('SRD 5.2 castellano (pendiente)');
      expect(zombie?.source).toBe('SRD 5.2 castellano (Wizards)');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('production es/ directory has >= 300 entries (locks in auto-build)', () => {
    const productionDir = resolve(
      __dirname,
      '..',
      '..',
      'data',
      'manuals',
      'dnd5e-2024',
      'monsters',
      'es',
    );
    if (!existsSync(productionDir)) {
      // eslint-disable-next-line no-console
      console.warn('Skipping: production es/ dir not present at', productionDir);
      return;
    }

    const repo = new MonstersRepository();
    const originalCwd = process.cwd();
    process.chdir(resolve(__dirname, '..', '..'));
    try {
      const items = repo.list('es', 'dnd5e-2024');
      expect(items.length).toBeGreaterThanOrEqual(300);
      // No null/empty names after the fix
      expect(items.every((it) => typeof it.name === 'string')).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
