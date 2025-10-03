# Manuals data directory

This folder contains file-based content for the public Manuals module. Each manual is stored in its own folder with a TOC and localized content files.

## Structure

- `registry.json`: Array of available manuals with id, title, version, licenseName, licenseUrl, locale, slug.
- `<manualId>/toc.json`: Tree of sections. Example node shape: `{ id, title, children: TocNode[] }`.
- `<manualId>/content/<nodeId>.json` or `<nodeId>.<lang>.json`:
  - `id`: string (must match the node id from the TOC)
  - `title`: string
  - `format`: `markdown` | `html`
  - One of:
    - `markdown`: string
    - `html`: string (only if trusted; avoid untrusted HTML)
  - `plainText`: short summary for search
  - `attribution`: optional attribution text

Localization is achieved by duplicating the same `id` file with a two-letter language suffix, e.g. `abilities.en.json`, `abilities.es.json`. The backend will pick `?lang=<code>` when present, falling back to `en` or `default` when needed.

## Adding content

1. Add the section to the manual's `toc.json` (use concise, URL-safe `id`).
2. Create one or more files under `content/` using `<id>.<lang>.json` convention.
3. Include a short `plainText` summary to improve search/snippets.
4. Keep paragraphs in Markdown for better formatting in the client.

## Licensing and attribution

The content is derived from the Dungeons & Dragons System Reference Documents:

- D&D 5e SRD 5.1 (2014) — available under Creative Commons Attribution 4.0 International (CC BY 4.0). See https://creativecommons.org/licenses/by/4.0/
- D&D 5e SRD 5.2 (2024) — available under Creative Commons Attribution 4.0 International (CC BY 4.0).

Attribution requirement (CC BY 4.0): include a notice similar to:

> Contains material from the D&D 5e System Reference Document by Wizards of the Coast, available under the Creative Commons Attribution 4.0 International License.

Do not include any non-SRD or closed content. Avoid trademarked logos and product identity beyond the SRD scope. Each page file may include an `attribution` field; otherwise the UI or documentation should provide a global attribution.

## Notes

- Keep IDs stable; the viewer uses them for deep links.
- If a section is removed from the TOC, consider keeping the file but unreachable, or delete it and reindex the search.
- When adding new locales, prefer ISO language codes (e.g., `en`, `es`).