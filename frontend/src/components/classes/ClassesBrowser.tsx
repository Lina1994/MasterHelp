import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Chip, Collapse, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { api } from '../../apiBase';
import { useTranslation } from 'react-i18next';

interface ClassFeature { id: string; name: string; level: number; description?: string }
interface ClassLevel { level: number; proficiencyBonus: number; features: string[]; [k: string]: any }
interface CharacterClass {
  id: string; name: string; hitDie: number; primaryAbilities: string[]; savingThrows: string[];
  proficiencies: { armor?: string[]; weapons?: string[]; tools?: string[] };
  skills: { choose: number; from: string[] };
  equipment: { choose: number; options: { id: string; description: string }[] }[];
  hitPoints?: { hitDice: string; at1stLevel: string; atHigherLevels: string };
  features: ClassFeature[];
  levels: ClassLevel[];
  subclasses?: { id: string; name: string; description?: string; grantedAtLevel: number; features: ClassFeature[] }[];
  spellcasting?: { ability?: string; progression?: string } | null;
  spells?: { byLevel?: Record<string, string[]> } | null;
}

interface SpellSummary { id: string; name: string; level: number; school: string; castingTime: string; range: string; duration: string; components: string }
interface SpellDetail extends SpellSummary { description?: string; classes?: string[]; materials?: string; ritual?: boolean; concentration?: boolean }

export default function ClassesBrowser({ manualId }: { manualId?: string }) {
  const { i18n, t } = useTranslation();
  const [classes, setClasses] = useState<CharacterClass[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [selectedSpell, setSelectedSpell] = useState<SpellDetail | null>(null);

  useEffect(() => {
    const lang = (i18n.language || 'en').slice(0,2) as 'en'|'es';
    if (!manualId) return;
    api.get(`/manuals/${manualId}/classes`, { params: { lang }})
      .then(r => setClasses(r.data || []))
      .catch(() => setClasses([]));
  }, [i18n.language, manualId]);

  const openSpellByName = async (name: string) => {
    if (!manualId) return;
    const lang = (i18n.language || 'en').slice(0,2) as 'en'|'es';
    try {
      const list = await api.get(`/manuals/${manualId}/spells`, { params: { lang, search: name, page: 1, pageSize: 1, sortBy: 'name', sortDir: 'asc' } });
      const first: SpellSummary | undefined = list.data?.items?.[0];
      if (!first) return;
      const detail = await api.get(`/manuals/${manualId}/spells/${first.id}`, { params: { lang } });
      setSelectedSpell(detail.data as SpellDetail);
    } catch {}
  };

  return (
    <Stack spacing={2}>
      {classes.map(c => {
        const isOpen = !!open[c.id];
        return (
          <Card key={c.id} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography variant="h5">{c.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    d{c.hitDie} • Saves: {c.savingThrows.join(', ')} • Primary: {c.primaryAbilities.join(', ')}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                    {(c.proficiencies.armor || []).map(a => (<Chip key={a} label={a} size="small" />))}
                    {(c.proficiencies.weapons || []).map(w => (<Chip key={w} label={w} size="small" />))}
                    {(c.proficiencies.tools || []).map(t => (<Chip key={t} label={t} size="small" />))}
                  </Stack>
                </Box>
                <IconButton onClick={() => setOpen({ ...open, [c.id]: !isOpen })}>
                  {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Stack>
              <Collapse in={isOpen}>
                <Box sx={{ mt: 2 }}>
                  {c.hitPoints ? (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1">{t('hit_points')}</Typography>
                      <Typography variant="body2">{t('hit_dice')}: {c.hitPoints.hitDice}</Typography>
                      <Typography variant="body2">{t('hp_first_level')}: {c.hitPoints.at1stLevel}</Typography>
                      <Typography variant="body2">{t('hp_higher_levels')}: {c.hitPoints.atHigherLevels}</Typography>
                    </Box>
                  ) : null}
                  <Typography variant="subtitle1">{t('features')}</Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {c.features.sort((a,b) => a.level - b.level).map(f => (
                      <Box key={f.id}>
                        <Typography variant="subtitle2">{f.name} ({t('lvl_abbr')} {f.level})</Typography>
                        {f.description && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{f.description}</Typography>}
                      </Box>
                    ))}
                  </Stack>
                  {c.spellcasting && c.spells?.byLevel ? (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1">{t('spells')}</Typography>
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        {Object.entries(c.spells.byLevel).sort(([a],[b]) => (a==="cantrip"?"0":a).localeCompare(b==="cantrip"?"0":b)).map(([lvl, names]) => (
                          <Box key={lvl}>
                            <Typography variant="subtitle2">{lvl === 'cantrip' ? t('cantrips') : `${t('level')} ${lvl}`}</Typography>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 0.5 }}>
                              {names.map(n => (
                                <Chip key={n} label={n} size="small" onClick={() => openSpellByName(n)} />
                              ))}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  ) : null}
                  {c.subclasses?.length ? (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1">{t('subclasses')}</Typography>
                      {c.subclasses.map(sc => (
                        <Box key={sc.id} sx={{ mt: 1 }}>
                          <Typography variant="subtitle2">{sc.name} ({t('lvl_abbr')} {sc.grantedAtLevel})</Typography>
                          {sc.description && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{sc.description}</Typography>}
                          {sc.features?.length ? (
                            <Stack spacing={1} sx={{ mt: 1 }}>
                              {sc.features.map(sf => (
                                <Box key={sf.id}>
                                  <Typography variant="body2">• {sf.name} (Lvl {sf.level})</Typography>
                                  {sf.description && (
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', ml: 2 }}>{sf.description}</Typography>
                                  )}
                                </Box>
                              ))}
                            </Stack>
                          ) : null}
                        </Box>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        );
      })}
      <Dialog open={!!selectedSpell} onClose={() => setSelectedSpell(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {selectedSpell?.name}
          <IconButton onClick={() => setSelectedSpell(null)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedSpell && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Level {selectedSpell.level} • {selectedSpell.school} • Cast: {selectedSpell.castingTime} • Range: {selectedSpell.range} • Duration: {selectedSpell.duration}
              </Typography>
              <Typography variant="body2" gutterBottom>Components: {selectedSpell.components}</Typography>
              {selectedSpell.description && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{selectedSpell.description}</Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
