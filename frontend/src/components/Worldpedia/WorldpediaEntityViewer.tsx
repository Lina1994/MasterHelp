import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { getCharacter, type CharacterPayload } from '../../api/characters';
import { getCampaignMonster, type CampaignMonsterDetail } from '../../api/bestiary/bestiaryApi';
import { getCampaignSpell, type CampaignSpellDetail } from '../../api/spells/spellsApi';
import { listMaps, getMapImageUrlSized, type MapItemDto } from '../../api/maps';
import { getShop, type Shop } from '../../api/shops';
import { getQuest, type QuestPayload } from '../../api/quests';
import { listEncounters, type EncounterSummary } from '../../api/encounters';
import { setActiveSkylineCharacterId } from '../../api/campaigns/activeSkylineCharacter';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';

interface Props {
  open: boolean;
  entityType: string | null;
  entityId: string | null;
  campaignId: string;
  onClose: () => void;
}

/**
 * A slide-out drawer that previews an app entity referenced from a
 * Worldpedia note link.
 *
 * Supported entity types: `character`, `monster`, `map`, `spell`.
 * For characters it also offers a "Send to Skyline" button.
 */
export default function WorldpediaEntityViewer({
  open,
  entityType,
  entityId,
  campaignId,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();

  /** Resolved UI language narrowed to the two supported API locales. */
  const lang: 'en' | 'es' = (i18n.language?.startsWith('es') ? 'es' : 'en');

  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  /* ── Fetch entity when drawer opens ────────────────────────────── */

  useEffect(() => {
    if (!open || !entityType || !entityId) {
      setEntity(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        let data: any = null;

        switch (entityType) {
          case 'character':
            data = await getCharacter(entityId);
            break;
          case 'monster':
            data = await getCampaignMonster(campaignId, entityId, lang);
            break;
          case 'spell':
            data = await getCampaignSpell(campaignId, entityId, lang);
            break;
          case 'map': {
            // No getMap(id) endpoint — fetch the list and find the entry.
            const maps = await listMaps({ campaignId });
            data = maps.find((m) => m.id === entityId) ?? null;
            break;
          }
          case 'shop':
            data = await getShop(entityId);
            break;
          case 'quest':
            data = await getQuest(entityId);
            break;
          case 'encounter': {
            const encounters = await listEncounters(campaignId);
            data = encounters.find((e) => e.id === entityId) ?? null;
            break;
          }
        }

        if (!cancelled) setEntity(data);
      } catch {
        if (!cancelled) setError(t('worldpedia_entity_load_error', 'Failed to load entity'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, entityType, entityId, campaignId, lang, t]);

  /* ── Send character to skyline ─────────────────────────────────── */

  const handleSendToSkyline = useCallback(async () => {
    if (!activeCampaign?.id || !entityId) return;
    try {
      await setActiveSkylineCharacterId(activeCampaign.id, entityId);
      // Notify projection window
      localStorage.setItem(
        'app.skyline.activeCharacterUpdated',
        JSON.stringify({ campaignId: activeCampaign.id, characterId: entityId, ts: Date.now() }),
      );
      try {
        new BroadcastChannel('campaign-sync').postMessage({
          type: 'activeSkylineChanged',
          campaignId: activeCampaign.id,
        });
      } catch { /* BroadcastChannel not supported */ }
      try {
        (window as any).electronAPI?.projectionPoke?.({
          kind: 'activeSkylineChanged',
          campaignId: activeCampaign.id,
        });
      } catch { /* electron not present */ }
    } catch {
      /* silent */
    }
  }, [activeCampaign?.id, entityId]);

  /* ── Render ────────────────────────────────────────────────────── */

  const renderCharacter = (ch: CharacterPayload) => (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{ch.name}</Typography>
      {ch.characterImageUrl && (
        <Box
          component="img"
          src={ch.characterImageUrl}
          alt={ch.name}
          sx={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 1, mb: 2 }}
        />
      )}
      <Stack spacing={0.5}>
        {ch.race && <Typography variant="body2"><strong>Race:</strong> {ch.race}</Typography>}
        {ch.className && <Typography variant="body2"><strong>Class:</strong> {ch.className} {ch.level ? `Lv.${ch.level}` : ''}</Typography>}
        {ch.alignment && <Typography variant="body2"><strong>Alignment:</strong> {ch.alignment}</Typography>}
        {ch.armorClass != null && <Typography variant="body2"><strong>AC:</strong> {ch.armorClass}</Typography>}
        {ch.maxHp != null && <Typography variant="body2"><strong>HP:</strong> {ch.currentHp ?? '?'}/{ch.maxHp}</Typography>}
        {ch.speed && <Typography variant="body2"><strong>Speed:</strong> {ch.speed}</Typography>}
      </Stack>

      {/* Ability scores */}
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ab) => (
          <Box key={ab} sx={{ textAlign: 'center', minWidth: 48 }}>
            <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>{ab}</Typography>
            <Typography variant="body2">{(ch as any)[ab] ?? '—'}</Typography>
          </Box>
        ))}
      </Stack>

      <Button
        variant="contained"
        size="small"
        sx={{ mt: 3 }}
        onClick={handleSendToSkyline}
      >
        Enviar a Skyline
      </Button>
    </Box>
  );

  /* ── Monster ────────────────────────────────────────────────────── */

  const renderMonster = (m: CampaignMonsterDetail) => (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{m.name}</Typography>
      {m.type && <Typography variant="body2" color="text.secondary">{m.size} {m.type}, {m.alignment}</Typography>}
      <Stack spacing={0.5} sx={{ mt: 2 }}>
        {m.armorClass && <Typography variant="body2"><strong>AC:</strong> {typeof m.armorClass === 'object' ? `${m.armorClass.value} (${m.armorClass.type || ''})` : m.armorClass}</Typography>}
        {m.hitPoints && <Typography variant="body2"><strong>HP:</strong> {m.hitPoints.average ?? m.hitPoints} ({(m.hitPoints as any).formula || (m.hitPoints as any).roll || ''})</Typography>}
        {m.challengeRating && <Typography variant="body2"><strong>CR:</strong> {m.challengeRating}</Typography>}
      </Stack>

      {/* Abilities */}
      {m.abilities && (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
          {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ab) => (
            <Box key={ab} sx={{ textAlign: 'center', minWidth: 48 }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>{ab}</Typography>
              <Typography variant="body2">{m.abilities?.[ab] ?? '—'}</Typography>
            </Box>
          ))}
        </Stack>
      )}

      {m.traits && m.traits.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{t('traits', 'Traits')}</Typography>
          {m.traits.map((tr, i) => (
            <Typography key={i} variant="body2"><strong>{tr.name}.</strong> {tr.text}</Typography>
          ))}
        </Box>
      )}
      {m.actions && m.actions.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{t('actions', 'Actions')}</Typography>
          {m.actions.map((a, i) => (
            <Typography key={i} variant="body2"><strong>{a.name}.</strong> {a.text}</Typography>
          ))}
        </Box>
      )}
      {m.reactions && m.reactions.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{t('reactions', 'Reactions')}</Typography>
          {m.reactions.map((r, i) => (
            <Typography key={i} variant="body2"><strong>{r.name}.</strong> {r.text}</Typography>
          ))}
        </Box>
      )}
      {m.legendaryActions && m.legendaryActions.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{t('legendary_actions', 'Legendary Actions')}</Typography>
          {m.legendaryActions.map((la, i) => (
            <Typography key={i} variant="body2"><strong>{la.name}.</strong> {la.text}</Typography>
          ))}
        </Box>
      )}
    </Box>
  );

  /* ── Spell ──────────────────────────────────────────────────────── */

  const renderSpell = (sp: CampaignSpellDetail) => (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{sp.name}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {sp.level === 0 ? t('cantrip', 'Cantrip') : `${t('level', 'Level')} ${sp.level}`}
        {sp.school ? ` — ${sp.school}` : ''}
      </Typography>

      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {sp.castingTime && <Typography variant="body2"><strong>{t('casting_time', 'Casting Time')}:</strong> {sp.castingTime}</Typography>}
        {sp.range && <Typography variant="body2"><strong>{t('range', 'Range')}:</strong> {sp.range}</Typography>}
        {sp.components && <Typography variant="body2"><strong>{t('components', 'Components')}:</strong> {sp.components}</Typography>}
        {sp.materials && <Typography variant="body2" sx={{ pl: 2, fontStyle: 'italic' }}>{sp.materials}</Typography>}
        {sp.duration && <Typography variant="body2"><strong>{t('duration', 'Duration')}:</strong> {sp.duration}</Typography>}
      </Stack>

      <Stack direction="row" gap={0.5} sx={{ mt: 1 }}>
        {sp.isConcentration && <Chip label={t('concentration', 'Concentration')} size="small" color="warning" variant="outlined" />}
        {sp.isRitual && <Chip label={t('ritual', 'Ritual')} size="small" color="info" variant="outlined" />}
      </Stack>

      {sp.description && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{t('description', 'Description')}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{sp.description}</Typography>
        </Box>
      )}

      {sp.classes && sp.classes.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{t('classes', 'Classes')}</Typography>
          <Typography variant="body2">{sp.classes.join(', ')}</Typography>
        </Box>
      )}
    </Box>
  );

  /* ── Map ────────────────────────────────────────────────────────── */

  const renderMap = (m: MapItemDto) => (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{m.name}</Typography>
      {m.imageAvailable && (
        <Box
          component="img"
          src={getMapImageUrlSized(m.id, 'preview')}
          alt={m.name}
          sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 1, mb: 2 }}
        />
      )}
      {m.description && <Typography variant="body2" sx={{ mb: 1 }}>{m.description}</Typography>}
      <Stack spacing={0.5}>
        {m.group && <Typography variant="body2"><strong>{t('group', 'Group')}:</strong> {m.group}</Typography>}
        {m.timeOfDay && <Typography variant="body2"><strong>{t('time_of_day', 'Time of Day')}:</strong> {m.timeOfDay}</Typography>}
        {m.isWorldMap && <Chip label={t('world_map', 'World Map')} size="small" color="primary" variant="outlined" sx={{ mt: 0.5 }} />}
      </Stack>
    </Box>
  );

  /* ── Shop ───────────────────────────────────────────────────────── */

  const renderShop = (shop: Shop) => (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{shop.name}</Typography>
      {shop.description && <Typography variant="body2" sx={{ mb: 2 }}>{shop.description}</Typography>}

      {shop.sections.map((section) => (
        <Box key={section.id} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{section.name}</Typography>
          <Divider sx={{ my: 0.5 }} />
          {section.entries.map((entry) => (
            <Stack key={entry.id} direction="row" spacing={1} sx={{ py: 0.25 }}>
              {entry.cells
                .filter((c) => c.column.cellType === 'text')
                .map((c) => (
                  <Typography key={c.id} variant="body2">{c.textValue ?? ''}</Typography>
                ))}
            </Stack>
          ))}
        </Box>
      ))}
    </Box>
  );

  /* ── Quest ──────────────────────────────────────────────────────── */

  const renderQuest = (q: QuestPayload) => {
    const statusColors: Record<string, 'default' | 'warning' | 'success'> = {
      not_accepted: 'default',
      accepted: 'warning',
      completed: 'success',
    };
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{q.title}</Typography>
        <Chip
          label={t(`quest_status_${q.status}`, q.status)}
          size="small"
          color={statusColors[q.status] ?? 'default'}
          sx={{ mb: 1 }}
        />
        {q.description && (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{q.description}</Typography>
        )}
        <Stack spacing={0.5} sx={{ mt: 2 }}>
          {q.createdBy && <Typography variant="body2"><strong>{t('created_by', 'Created by')}:</strong> {q.createdBy.username}</Typography>}
          {q.prerequisiteQuest && <Typography variant="body2"><strong>{t('prerequisite', 'Prerequisite')}:</strong> {q.prerequisiteQuest.title}</Typography>}
          <Typography variant="body2" color="text.secondary">{new Date(q.createdAt).toLocaleDateString()}</Typography>
        </Stack>
      </Box>
    );
  };

  /* ── Encounter ─────────────────────────────────────────────────── */

  const renderEncounter = (enc: EncounterSummary) => (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{enc.name}</Typography>
      <Chip
        label={enc.difficulty}
        size="small"
        color={
          enc.difficulty === 'Mortal' ? 'error'
            : enc.difficulty === 'Difícil' ? 'warning'
              : enc.difficulty === 'Medio' ? 'info'
                : 'default'
        }
        sx={{ mb: 1 }}
      />

      {enc.participants.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{t('participants', 'Participants')}</Typography>
          <Divider sx={{ mb: 0.5 }} />
          {enc.participants.map((p) => (
            <Stack key={p.id} direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
              <Typography variant="body2">
                {p.name} <Typography component="span" variant="caption" color="text.secondary">({p.kind})</Typography>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {p.maxHp != null ? `HP ${p.currentHp ?? '?'}/${p.maxHp}` : ''}
                {p.cr != null ? ` CR ${p.cr}` : ''}
              </Typography>
            </Stack>
          ))}
        </Box>
      )}
    </Box>
  );

  /* ── Fallback ───────────────────────────────────────────────────── */

  const renderFallback = () => (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {entityType}: {entityId}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        {t('worldpedia_entity_preview_unavailable', 'Preview not available for this entity type yet.')}
      </Typography>
    </Box>
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '90vw', sm: 400 }, p: 2 } }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {entityType ? entityType.charAt(0).toUpperCase() + entityType.slice(1) : 'Entity'}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Typography color="error">{error}</Typography>}

      {!loading && !error && entity && (
        <>
          {entityType === 'character' && renderCharacter(entity)}
          {entityType === 'monster' && renderMonster(entity)}
          {entityType === 'spell' && renderSpell(entity)}
          {entityType === 'map' && renderMap(entity)}
          {entityType === 'shop' && renderShop(entity)}
          {entityType === 'quest' && renderQuest(entity)}
          {entityType === 'encounter' && renderEncounter(entity)}
          {!['character', 'monster', 'spell', 'map', 'shop', 'quest', 'encounter'].includes(entityType ?? '') && renderFallback()}
        </>
      )}
    </Drawer>
  );
}
