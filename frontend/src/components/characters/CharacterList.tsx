import React, { useEffect, useMemo, useState } from 'react';
import { listCharacters, createCharacter, updateCharacter, deleteCharacter, CharacterPayload } from '../../api/characters';
import { useCampaignId } from '../../hooks/useCampaignId';
import { useTranslation } from 'react-i18next';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, FormHelperText, IconButton, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography, Card, CardHeader, CardContent, CardActions, Avatar, Chip, Tooltip, CardActionArea } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { ImageUploader } from '../Campaign/ImageUploader';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../../utils/getCurrentUser';
import { CharacterEditorModal } from './CharacterEditorModal';

function emptyCharacter(campaignId: string): CharacterPayload {
  return {
    campaignId,
    name: '',
    kind: 'pc',
    level: 1,
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    proficiencyBonus: 2,
    armorClass: 10,
    initiative: 0,
    speed: '30 ft',
    maxHp: 8,
    currentHp: 8,
    tempHp: 0,
    hitDice: '1d8',
    visibleToPlayers: false,
  };
}

export const CharacterList: React.FC = () => {
  const campaignId = useCampaignId();
  const { t } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const currentUser = getCurrentUser();
  const isMaster = !!(activeCampaign && currentUser && activeCampaign.owner?.id === currentUser.id);
  const navigate = useNavigate();
  const campaignPlayers = useMemo(() => {
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
  const [items, setItems] = useState<CharacterPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [openEditor, setOpenEditor] = useState(false);
  const [draft, setDraft] = useState<CharacterPayload | null>(null);
  // Remove tab and errorText state, handled in modal

  const load = async () => {
    setLoading(true);
    try {
      const data = await listCharacters(campaignId);
      setItems(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [campaignId]);

  const onCreate = () => {
    setDraft(emptyCharacter(campaignId));
    setOpenEditor(true);
  };

  const onEdit = (c: CharacterPayload) => {
    setDraft({ ...c, ownerPlayerId: typeof c.ownerPlayerId !== 'undefined' ? c.ownerPlayerId : (c as any).ownerPlayer?.id ?? null });
    setOpenEditor(true);
  };

  const onDelete = async (c: CharacterPayload) => {
    await deleteCharacter(c.id!);
    await load();
  };

  // Remove onSave, handled in modal

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">{t('characters', 'Personajes')}</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={onCreate}>{t('new', 'Nuevo')}</Button>
      </Stack>
      {items.length === 0 ? (
        <Typography color="text.secondary">{loading ? t('loading', 'Cargando...') : t('no_characters', 'No hay personajes')}</Typography>
      ) : (
        <Grid container spacing={2}>
          {items.map((c) => {
            const initials = (c.name || '?').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
            const title = `${c.name}`;
            const subheader = [c.kind?.toUpperCase(), c.className, c.race].filter(Boolean).join(' • ');
            const avatarBg = c.tokenColor || '#607d8b';
            return (
              <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}>
                <Card variant="outlined">
                  <CardActionArea onClick={() => navigate(`/characters/${c.id}`)}>
                  <CardHeader
                    avatar={
                      c.tokenKind === 'image' && c.tokenImageUrl ? (
                        <Avatar src={c.tokenImageUrl} alt={c.name} />
                      ) : (
                        <Avatar sx={{ bgcolor: avatarBg }}>{initials}</Avatar>
                      )
                    }
                    title={title}
                    subheader={subheader}
                  />
                  <CardContent>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {typeof c.level === 'number' && <Chip size="small" label={`Nv ${c.level}`} />}
                      {typeof c.armorClass === 'number' && <Chip size="small" label={`AC ${c.armorClass}`} />}
                      {typeof c.currentHp === 'number' && typeof c.maxHp === 'number' && (
                        <Chip size="small" label={`PG ${c.currentHp}/${c.maxHp}`} />
                      )}
                      <Chip size="small" label={c.visibleToPlayers ? t('visible','Visible') : t('hidden','Oculto')} color={c.visibleToPlayers ? 'success' : 'default'} />
                      {c.ownerPlayerId ? (
                        <Tooltip title={t('owner','Propietario') as string}><Chip size="small" label={c.ownerPlayer?.username || `UID ${c.ownerPlayerId}`} /></Tooltip>
                      ) : (
                        <Chip size="small" label={t('npc','NPC')} variant="outlined" />
                      )}
                    </Stack>
                  </CardContent>
                  </CardActionArea>
                  <CardActions>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => onEdit(c)}>{t('edit','Editar')}</Button>
                    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => onDelete(c)}>{t('delete','Eliminar')}</Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <CharacterEditorModal
        open={openEditor}
        initialDraft={draft}
        onClose={() => { setOpenEditor(false); setDraft(null); }}
        onSaved={() => { setOpenEditor(false); setDraft(null); load(); }}
        campaignPlayers={campaignPlayers}
        isMaster={isMaster}
      />
    </Box>
  );
};

export default CharacterList;
