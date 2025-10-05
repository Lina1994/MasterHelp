import { useEffect, useMemo, useState } from 'react';
import { api } from '../../apiBase';
import { Box, Card, CardContent, Chip, Collapse, IconButton, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';

type AbilityBonuses = Partial<Record<'str'|'dex'|'con'|'int'|'wis'|'cha', number>>;

interface RaceTraitEffect {
  type: 'advantage_saves' | 'resistance' | 'expertise_check' | 'hp_per_level';
  vs?: string[];
  damage?: string[];
  skill?: string;
  condition?: string;
  value?: number;
}

interface RaceTrait { id: string; name: string; effects: RaceTraitEffect[] }
interface Subrace { id: string; name: string; abilityBonuses?: AbilityBonuses; proficiencies?: any; traits?: RaceTrait[] }
interface Race {
  id: string;
  name: string;
  source?: string;
  abilityBonuses?: AbilityBonuses;
  age?: { maturity?: number; youngUntil?: number; max?: number };
  size: string;
  sizeDetails?: { heightMinInches?: number; heightMaxInches?: number; weightAvgLbs?: number };
  alignment?: { tendencies?: string[] };
  speed: { walk?: number; noHeavyArmorPenalty?: boolean };
  languages?: string[];
  proficiencies?: { weapons?: string[]; armor?: string[]; tools?: string[] };
  senses?: { darkvision?: number; noColor?: boolean };
  traits?: RaceTrait[];
  subraces?: Subrace[];
}

export default function RacesBrowser({ manualId }: { manualId?: string }) {
  const [items, setItems] = useState<Race[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { i18n, t } = useTranslation();

  const lang = useMemo<'en'|'es'>(() => {
    const code = (i18n.language || 'en').slice(0,2);
    return (code === 'es' ? 'es' : 'en');
  }, [i18n.language]);

  useEffect(() => {
    if (!manualId) return;
    api.get(`/manuals/${manualId}/races`, { params: { lang } })
      .then(res => setItems(Array.isArray(res.data) ? res.data : []))
      .catch(() => setItems([]));
  }, [manualId, lang]);

  if (!manualId) return null;

  return (
    <Stack spacing={2}>
      {items.map(r => (
        <Card key={r.id} variant="outlined">
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h6">{r.name}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {r.abilityBonuses && Object.entries(r.abilityBonuses).map(([k,v]) => (
                    <Chip key={k} size="small" label={`${k.toUpperCase()} +${v}`} />
                  ))}
                  {r.speed?.walk && <Chip size="small" label={`${t('speed_label','Speed')} ${r.speed.walk} ${t('feet_abbr','ft')}`} />}
                  {r.senses?.darkvision && <Chip size="small" label={`${t('darkvision_label','Darkvision')} ${r.senses.darkvision} ${t('feet_abbr','ft')}`} />}
                </Stack>
              </Box>
              <IconButton onClick={() => setOpen(o => ({ ...o, [r.id]: !o[r.id] }))}>
                <ExpandMoreIcon />
              </IconButton>
            </Box>
            <Collapse in={!!open[r.id]} timeout="auto" unmountOnExit>
              <Box sx={{ mt: 2 }}>
                {r.languages?.length ? (
                  <Typography variant="body2">{t('languages','Languages')}: {r.languages.join(', ')}</Typography>
                ) : null}
                {r.alignment?.tendencies?.length ? (
                  <Typography variant="body2">{t('alignment_tendencies','Alignment tendencies')}: {r.alignment.tendencies.join(', ')}</Typography>
                ) : null}
                {r.age ? (
                  <Typography variant="body2">{t('age','Age')}: {t('mature','Mature')} {r.age.maturity ?? '-'}; {t('young_until','Young until')} {r.age.youngUntil ?? '-'}; {t('max','Max')} {r.age.max ?? '-'}</Typography>
                ) : null}
                {r.sizeDetails ? (
                  <Typography variant="body2">{t('size_label','Size')}: {r.size} ({t('height','height')} {r.sizeDetails.heightMinInches}-{r.sizeDetails.heightMaxInches} {t('inches_abbr','in')}; {t('avg','avg')} {r.sizeDetails.weightAvgLbs} lb)</Typography>
                ) : (
                  <Typography variant="body2">{t('size_label','Size')}: {r.size}</Typography>
                )}
                {r.proficiencies?.weapons?.length ? (
                  <Typography variant="body2">{t('weapon_proficiencies','Weapon proficiencies')}: {r.proficiencies.weapons.join(', ')}</Typography>
                ) : null}
                {r.proficiencies?.armor?.length ? (
                  <Typography variant="body2">{t('armor_proficiencies','Armor proficiencies')}: {r.proficiencies.armor.join(', ')}</Typography>
                ) : null}
                {r.proficiencies?.tools?.length ? (
                  <Typography variant="body2">{t('tool_proficiencies','Tool proficiencies')}: {r.proficiencies.tools.join(', ')}</Typography>
                ) : null}
                {r.speed?.noHeavyArmorPenalty ? (
                  <Typography variant="body2">{t('speed_no_heavy_armor_penalty','Speed is not reduced by wearing heavy armor.')}</Typography>
                ) : null}
                {r.traits?.length ? (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2">{t('traits','Traits')}</Typography>
                    <ul>
                      {r.traits.map(t => (
                        <li key={t.id}>
                          <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                          {t as any && (t as any).description && (
                            <Typography variant="body2" color="text.secondary">{(t as any).description}</Typography>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Box>
                ) : null}
                
                {r.subraces?.length ? (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2">{t('subraces','Subraces')}</Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {r.subraces.map(sr => (
                        <Card key={sr.id} variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" fontWeight={600}>{sr.name}</Typography>
                            {(sr as any).description && (
                              <Typography variant="body2" color="text.secondary">{(sr as any).description}</Typography>
                            )}
                            {sr.abilityBonuses && (
                              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                {Object.entries(sr.abilityBonuses).map(([k,v]) => (
                                  <Chip key={k} size="small" label={`${k.toUpperCase()} +${v}`} />
                                ))}
                              </Stack>
                            )}
                            {sr.proficiencies?.armor?.length ? (
                              <Typography variant="body2" sx={{ mt: 1 }}>{t('armor_proficiencies','Armor proficiencies')}: {sr.proficiencies.armor.join(', ')}</Typography>
                            ) : null}
                            {sr.traits?.length ? (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" fontWeight={600}>{t('traits','Traits')}</Typography>
                                <ul>
                                  {sr.traits.map(tr => (
                                    <li key={tr.id}>
                                      <Typography variant="body2">{tr.name}</Typography>
                                      {(tr as any).description && (
                                        <Typography variant="body2" color="text.secondary">{(tr as any).description}</Typography>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </Box>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
