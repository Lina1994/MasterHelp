import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { NoteLinkPayload, WorldpediaNoteLight } from '../../api/worldpedia/worldpediaApi';
import { getWorldpediaTree } from '../../api/worldpedia/worldpediaApi';

// Entity API imports
import { listCharacters } from '../../api/characters';
import { listCampaignMonsters, type CampaignMonsterListItem } from '../../api/bestiary/bestiaryApi';
import { listMaps } from '../../api/maps';
import { listCampaignSpells, type CampaignSpellListItem } from '../../api/spells/spellsApi';
import { listShops } from '../../api/shops';
import { listQuests } from '../../api/quests';
import { listEncounters } from '../../api/encounters';

interface Props {
  open: boolean;
  campaignId: string;
  /**
   * Pre-filled label coming from the text selected in the editor.
   * When provided the label field starts with this value.
   */
  initialLabel?: string;
  onClose: () => void;
  onInsert: (link: NoteLinkPayload) => void;
}

type LinkType = 'url' | 'note' | 'entity';

/** Simple { id, name } representation used by the entity Autocomplete. */
interface EntityOption {
  id: string;
  name: string;
}

/**
 * Supported entity sections that map to app data.
 * The `key` is persisted into the link; `labelKey` is the i18n key shown
 * in the dropdown.
 */
const ENTITY_SECTIONS = [
  { key: 'character', labelKey: 'characters' },
  { key: 'monster', labelKey: 'bestiary' },
  { key: 'map', labelKey: 'maps' },
  { key: 'spell', labelKey: 'spells' },
  { key: 'shop', labelKey: 'shops' },
  { key: 'quest', labelKey: 'quests' },
  { key: 'encounter', labelKey: 'encounters' },
] as const;

/** Note option enriched with the folder name for grouping. */
interface NoteOption extends WorldpediaNoteLight {
  folderName: string;
}

/**
 * Dialog for inserting a typed link into a Worldpedia note.
 *
 * - **URL** — free-form URL input.
 * - **Note** — browse all Worldpedia notes grouped by folder.
 * - **Entity** — choose a section of the app, then pick an element from a
 *   dropdown that is populated with that section's data.
 */
export default function WorldpediaLinkInserter({ open, campaignId, initialLabel = '', onClose, onInsert }: Props) {
  const { t, i18n } = useTranslation();

  /** Resolved UI language narrowed to the two supported API locales. */
  const lang: 'en' | 'es' = (i18n.language?.startsWith('es') ? 'es' : 'en');

  const [linkType, setLinkType] = useState<LinkType>('url');
  const [label, setLabel] = useState('');

  // URL
  const [url, setUrl] = useState('');

  // Note
  const [noteOptions, setNoteOptions] = useState<NoteOption[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteOption | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);

  // Entity
  const [entitySection, setEntitySection] = useState<string>('character');
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);

  /* ── Reset on open ─────────────────────────────────────────────── */

  const handleEnter = () => {
    setLinkType('url');
    setLabel(initialLabel);
    setUrl('');
    setSelectedNote(null);
    setNoteOptions([]);
    setEntitySection('character');
    setSelectedEntity(null);
    setEntityOptions([]);
  };

  /* ── Load notes tree when "note" tab is selected ───────────────── */

  useEffect(() => {
    if (!open || linkType !== 'note') return;
    let cancelled = false;

    const load = async () => {
      setNoteLoading(true);
      try {
        const tree = await getWorldpediaTree(campaignId);
        if (cancelled) return;

        const opts: NoteOption[] = [];

        // Notes inside folders
        for (const folder of tree.folders) {
          for (const n of folder.notes) {
            opts.push({ ...n, folderName: folder.name });
          }
        }

        // Root notes (no folder)
        for (const n of tree.rootNotes) {
          opts.push({ ...n, folderName: t('worldpedia_root', 'Root') });
        }

        setNoteOptions(opts);
      } catch {
        setNoteOptions([]);
      } finally {
        if (!cancelled) setNoteLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, linkType, campaignId, t]);

  /* ── Load entity list when section changes ─────────────────────── */

  useEffect(() => {
    if (!open || linkType !== 'entity') return;
    let cancelled = false;

    const load = async () => {
      setEntityLoading(true);
      setSelectedEntity(null);
      setEntityOptions([]);
      try {
        let items: EntityOption[] = [];

        switch (entitySection) {
          case 'character': {
            const chars = await listCharacters(campaignId);
            items = chars.map((c) => ({ id: c.id!, name: c.name }));
            break;
          }
          case 'monster': {
            const res = await listCampaignMonsters(campaignId, { pageSize: 1000 }, lang);
            const list: CampaignMonsterListItem[] = res.items ?? [];
            items = list.map((m) => ({ id: m.id, name: m.name }));
            break;
          }
          case 'map': {
            const maps = await listMaps({ campaignId });
            items = maps.map((m) => ({ id: m.id, name: m.name }));
            break;
          }
          case 'spell': {
            const res = await listCampaignSpells(campaignId, { pageSize: 1000 }, lang);
            const list: CampaignSpellListItem[] = res.items ?? [];
            items = list.map((s) => ({ id: s.id, name: s.name }));
            break;
          }
          case 'shop': {
            const shops = await listShops(campaignId);
            items = shops.map((s) => ({ id: s.id, name: s.name }));
            break;
          }
          case 'quest': {
            const quests = await listQuests(campaignId);
            items = quests.map((q) => ({ id: q.id, name: q.title }));
            break;
          }
          case 'encounter': {
            const encounters = await listEncounters(campaignId);
            items = encounters.map((e) => ({ id: e.id, name: e.name }));
            break;
          }
        }

        if (!cancelled) {
          items.sort((a, b) => a.name.localeCompare(b.name));
          setEntityOptions(items);
        }
      } catch {
        if (!cancelled) setEntityOptions([]);
      } finally {
        if (!cancelled) setEntityLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, linkType, entitySection, campaignId, lang]);

  /* ── Insert ────────────────────────────────────────────────────── */

  const handleInsert = () => {
    const link: NoteLinkPayload = { type: linkType, label: label || null };

    if (linkType === 'url') {
      if (!url.trim()) return;
      link.targetUrl = url.trim();
      if (!link.label) link.label = url.trim();
    } else if (linkType === 'note') {
      if (!selectedNote) return;
      link.targetNoteId = selectedNote.id;
      if (!link.label) link.label = selectedNote.title;
    } else if (linkType === 'entity') {
      if (!selectedEntity) return;
      link.targetEntityType = entitySection;
      link.targetEntityId = selectedEntity.id;
      if (!link.label) link.label = selectedEntity.name;
    }

    onInsert(link);
    onClose();
  };

  /** Localised label for the currently chosen entity section. */
  const sectionLabel = useMemo(() => {
    const match = ENTITY_SECTIONS.find((s) => s.key === entitySection);
    return match ? t(match.labelKey, match.key) : entitySection;
  }, [entitySection, t]);

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth TransitionProps={{ onEnter: handleEnter }}>
      <DialogTitle>{t('worldpedia_insert_link', 'Insert link')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {/* Type selector */}
        <FormControl fullWidth size="small">
          <InputLabel>{t('worldpedia_link_type', 'Type')}</InputLabel>
          <Select value={linkType} label={t('worldpedia_link_type', 'Type')} onChange={(e) => setLinkType(e.target.value as LinkType)}>
            <MenuItem value="url">{t('worldpedia_link_url', 'Web URL')}</MenuItem>
            <MenuItem value="note">{t('worldpedia_link_note', 'Worldpedia note')}</MenuItem>
            <MenuItem value="entity">{t('worldpedia_link_entity', 'App entity')}</MenuItem>
          </Select>
        </FormControl>

        {/* Label (optional) */}
        <TextField
          size="small"
          label={t('worldpedia_link_label', 'Label')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          helperText={t('worldpedia_link_label_hint', 'Optional. Auto-filled from selection if empty.')}
        />

        {/* ───────── URL ───────── */}
        {linkType === 'url' && (
          <TextField
            size="small"
            label="URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        )}

        {/* ───────── Note ──────── */}
        {linkType === 'note' && (
          <Autocomplete
            size="small"
            options={noteOptions}
            groupBy={(opt) => opt.folderName}
            getOptionLabel={(opt) => opt.title}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            loading={noteLoading}
            value={selectedNote}
            onChange={(_, val) => setSelectedNote(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('worldpedia_search', 'Search notes…')}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {noteLoading && <CircularProgress size={18} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        )}

        {/* ───────── Entity ─────── */}
        {linkType === 'entity' && (
          <>
            {/* Section selector */}
            <FormControl fullWidth size="small">
              <InputLabel>{t('worldpedia_entity_section', 'Section')}</InputLabel>
              <Select
                value={entitySection}
                label={t('worldpedia_entity_section', 'Section')}
                onChange={(e) => setEntitySection(e.target.value)}
              >
                {ENTITY_SECTIONS.map((s) => (
                  <MenuItem key={s.key} value={s.key}>{t(s.labelKey, s.key)}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Element picker */}
            <Autocomplete
              size="small"
              options={entityOptions}
              getOptionLabel={(opt) => opt.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              loading={entityLoading}
              value={selectedEntity}
              onChange={(_, val) => setSelectedEntity(val)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('worldpedia_entity_pick', 'Choose element')}
                  placeholder={sectionLabel}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {entityLoading && <CircularProgress size={18} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={handleInsert}>
          {t('worldpedia_insert_link', 'Insert link')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
