import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Breadcrumbs, Button, Card, CardContent, CardHeader, Chip, CircularProgress, Stack, Typography, Avatar } from '@mui/material';
import Grid from '@mui/material/Grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { getCharacter, CharacterPayload } from '../api/characters';
import { CharacterEditorModal } from '../components/characters/CharacterEditorModal';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { useTranslation } from 'react-i18next';

const Section: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <Card variant="outlined" sx={{ mb: 2 }}>
    <CardHeader title={title} />
    <CardContent>
      {children}
    </CardContent>
  </Card>
);

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <Stack direction="row" spacing={1} sx={{ py: 0.5 }}>
    <Typography sx={{ minWidth: 180 }} color="text.secondary">{label}</Typography>
    <Typography>{value || '-'}</Typography>
  </Stack>
);

const CharacterDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const [data, setData] = useState<CharacterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (id && activeCampaign?.id) {
          const ch = await getCharacter(id);
          if (mounted) setData(ch);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, activeCampaign?.id]);

  // Compute campaignPlayers and isMaster for modal
  const currentUser = (activeCampaign && activeCampaign.owner) ? activeCampaign.owner : null;
  const isMaster = !!(activeCampaign && currentUser && activeCampaign.owner?.id === currentUser.id);
  const campaignPlayers = React.useMemo(() => {
    if (!activeCampaign) return [] as { id: number; label: string }[];
    const owner = activeCampaign.owner ? [{ id: activeCampaign.owner.id, label: `${activeCampaign.owner.username} (Master)` }] : [];
    const players = (activeCampaign.players || [])
      .filter(p => p.status === 'active')
      .map(p => ({ id: p.user.id, label: p.user.username }));
    // Deduplicate if owner also appears as player role
    const map = new Map<number, string>();
    [...owner, ...players].forEach(({ id, label }) => { if (!map.has(id)) map.set(id, label); });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [activeCampaign]);

  if (!activeCampaign) {
    return (
      <Box sx={{ p: 2 }}>
        <Stack spacing={2} alignItems="flex-start">
          <Typography color="text.secondary">Selecciona una campaña para ver la ficha del personaje.</Typography>
          <Button variant="contained" onClick={() => navigate('/campaigns')}>{t('go_to_campaigns','Ir a campañas')}</Button>
        </Stack>
      </Box>
    );
  }

  if (loading) {
    return <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  }
  if (!data) {
    return <Box sx={{ p: 2 }}><Typography color="error">{t('not_found','No encontrado')}</Typography></Box>;
  }

  const initials = (data.name || '?').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  const avatarBg = data.tokenColor || '#607d8b';

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>{t('back','Volver')}</Button>
          <Breadcrumbs>
            <Typography color="text.secondary">{t('characters','Personajes')}</Typography>
            <Typography>{data.name}</Typography>
          </Breadcrumbs>
        </Stack>
        <Button startIcon={<EditIcon />} onClick={() => setEditorOpen(true)}>{t('edit','Editar')}</Button>
      </Stack>
      <CharacterEditorModal
        open={editorOpen}
        initialDraft={data}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); setLoading(true); getCharacter(id!).then(setData).finally(() => setLoading(false)); }}
        campaignPlayers={campaignPlayers}
        isMaster={isMaster}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            {data.tokenKind === 'image' && data.tokenImageUrl ? (
              <Avatar src={data.tokenImageUrl} alt={data.name} sx={{ width: 56, height: 56 }} />
            ) : (
              <Avatar sx={{ bgcolor: avatarBg, width: 56, height: 56 }}>{initials}</Avatar>
            )}
            <Stack>
              <Typography variant="h5">{data.name}</Typography>
              <Stack direction="row" spacing={1}>
                {data.kind && <Chip size="small" label={data.kind.toUpperCase()} />}
                {typeof data.level === 'number' && <Chip size="small" label={`Nv ${data.level}`} />}
                {data.className && <Chip size="small" label={data.className} />}
                {data.race && <Chip size="small" label={data.race} />}
                <Chip size="small" label={data.visibleToPlayers ? t('visible','Visible') : t('hidden','Oculto')} color={data.visibleToPlayers ? 'success' : 'default'} />
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Section title={t('sheet','Ficha')}>
            <Row label={t('class','Clase')} value={data.className} />
            <Row label={t('level','Nivel')} value={data.level} />
            <Row label={t('background','Trasfondo')} value={data.background} />
            <Row label={t('race','Raza')} value={data.race} />
            <Row label={t('alignment','Alineamiento')} value={data.alignment} />
            {data.playerName && <Row label={t('player_name','Nombre del Jugador')} value={data.playerName} />}
            <Row label={t('proficiency_bonus','Bonificación por Competencia')} value={data.proficiencyBonus} />
            <Row label="AC" value={data.armorClass} />
            <Row label={t('initiative','Iniciativa')} value={data.initiative} />
            <Row label={t('speed','Velocidad')} value={data.speed} />
            <Row label={t('max_hp','PG Máx.')} value={data.maxHp} />
            <Row label={t('hp','PG')} value={data.currentHp} />
            <Row label={t('temp_hp','PG Temp.')} value={data.tempHp} />
            <Row label={t('hit_dice','Dados de Golpe')} value={data.hitDice} />
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {(['str','dex','con','int','wis','cha'] as const).map((k) => (
                <Chip key={k} label={`${k.toUpperCase()}: ${(data as any)[k]}`} />
              ))}
            </Stack>
          </Section>
          <Section title={t('magic','Magia')}>
            <Row label={t('spellcasting_ability','Aptitud Mágica')} value={data.spellcastingAbility?.toUpperCase()} />
            <Row label={t('spell_save_dc','CD Salvación Conjuros')} value={data.spellSaveDC} />
            <Row label={t('spell_attack_bonus','Bonificador Ataque Conjuro')} value={data.spellAttackBonus} />
            {data.cantrips && data.cantrips.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 1 }}>{t('cantrips','Trucos')}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {data.cantrips.map((c) => <Chip key={c} label={c} />)}
                </Stack>
              </>
            )}
            {data.spellsByLevel && (
              <>
                {Object.entries(data.spellsByLevel).map(([lvl, spells]) => (
                  <Box key={lvl} sx={{ mt: 1 }}>
                    <Typography variant="subtitle2">{t('spells_level','Conjuros nivel')} {lvl}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {spells.map((s) => <Chip key={`${lvl}-${s}`} label={s} />)}
                    </Stack>
                  </Box>
                ))}
              </>
            )}
          </Section>
  </Grid>
  <Grid size={{ xs: 12, md: 6 }}>
          <Section title={t('description_token','Descripción y Token')}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                {data.characterImageUrl ? (
                  <Box component="img" src={data.characterImageUrl} alt={data.name} sx={{ width: '100%', borderRadius: 1 }} />
                ) : (
                  <Box sx={{ width: '100%', height: 160, bgcolor: 'action.hover', borderRadius: 1 }} />
                )}
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Row label={t('age','Edad')} value={data.age} />
                <Row label={t('height','Altura')} value={data.height} />
                <Row label={t('weight','Peso')} value={data.weight} />
                <Row label={t('eyes','Ojos')} value={data.eyes} />
                <Row label={t('skin','Piel')} value={data.skin} />
                <Row label={t('hair','Pelo')} value={data.hair} />
              </Grid>
            </Grid>
            {data.alliesAndOrganizations && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">{t('allies_orgs','Aliados y organizaciones')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{data.alliesAndOrganizations}</Typography>
              </Box>
            )}
            {data.backstory && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">{t('backstory','Historia del personaje')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{data.backstory}</Typography>
              </Box>
            )}
            {data.treasure && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">{t('treasure','Tesoro')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{data.treasure}</Typography>
              </Box>
            )}
          </Section>
          <Section title={t('other','Otros')}>
            {data.otherProficienciesAndLanguages && <Row label={t('other_proficiencies','Otras Competencias e Idiomas')} value={<Typography sx={{ whiteSpace: 'pre-wrap' }}>{data.otherProficienciesAndLanguages}</Typography>} />}
            {data.equipment && <Row label={t('equipment','Equipo')} value={<Typography sx={{ whiteSpace: 'pre-wrap' }}>{data.equipment}</Typography>} />}
            {data.traitsAndFeatures && <Row label={t('traits_and_features','Rasgos y Atributos')} value={<Typography sx={{ whiteSpace: 'pre-wrap' }}>{data.traitsAndFeatures}</Typography>} />}
          </Section>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CharacterDetailPage;
