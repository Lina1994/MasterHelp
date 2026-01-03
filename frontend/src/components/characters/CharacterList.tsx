import React, { useEffect, useMemo, useState } from 'react';
import { listCharacters, deleteCharacter, CharacterPayload } from '../../api/characters';
import { setActiveSkylineCharacterId } from '../../api/campaigns/activeSkylineCharacter';
import { useCampaignId } from '../../hooks/useCampaignId';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useActiveCampaign } from '../Campaign/ActiveCampaignContext';
import { useCampaignsContext } from '../Campaign/CampaignContext';
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
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuCharacter, setMenuCharacter] = useState<CharacterPayload | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CharacterPayload | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [settingSkylineId, setSettingSkylineId] = useState<string | null>(null);
  const { fetchCampaigns } = useCampaignsContext();

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

  const openMenu = (event: React.MouseEvent<HTMLElement>, character: CharacterPayload) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuCharacter(character);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuCharacter(null);
  };

  const handleEditFromMenu = () => {
    if (menuCharacter) {
      onEdit(menuCharacter);
    }
    closeMenu();
  };

  const requestDelete = () => {
    if (menuCharacter) {
      setDeleteTarget(menuCharacter);
    }
    closeMenu();
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await deleteCharacter(deleteTarget.id);
      await load();
      setDeleteTarget(null);
    } catch (err) {
      console.error('[CharacterList] delete failed', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleSkylineToggle = async (character: CharacterPayload) => {
    if (!activeCampaign?.id || !character.id || !isMaster) return;
    const isActive = activeCampaign.activeSkylineCharacter?.id === character.id;
    setSettingSkylineId(character.id);
    try {
      const nextValue = isActive ? null : character.id;
      await setActiveSkylineCharacterId(activeCampaign.id, nextValue);
      await fetchCampaigns();
      try {
        localStorage.setItem('app.skyline.activeCharacterUpdated', JSON.stringify({ campaignId: activeCampaign.id, at: Date.now() }));
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('campaign-sync');
          bc.postMessage({ type: 'activeSkylineChanged', campaignId: activeCampaign.id });
          bc.close();
        }
        try { (window as any).electronAPI?.projectionPoke?.({ kind: 'activeSkylineChanged', campaignId: activeCampaign.id }); } catch {}
      } catch {}
    } catch (err) {
      console.error('[CharacterList] skyline toggle failed', err);
    } finally {
      setSettingSkylineId(null);
    }
  };

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
                  <CardActions sx={{ justifyContent: 'space-between' }}>
                    {isMaster && activeCampaign?.id && (
                      <Button
                        size="small"
                        variant={activeCampaign.activeSkylineCharacter?.id === c.id ? 'outlined' : 'contained'}
                        color={activeCampaign.activeSkylineCharacter?.id === c.id ? 'warning' : 'primary'}
                        disabled={settingSkylineId === c.id}
                        onClick={() => handleSkylineToggle(c)}
                      >
                        {activeCampaign.activeSkylineCharacter?.id === c.id ? 'Quitar de Skyline' : 'Enviar a Skyline'}
                      </Button>
                    )}
                    <IconButton aria-label={t('more_options','Más opciones')} onClick={(e) => openMenu(e, c)}>
                      <MoreVertIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={handleEditFromMenu}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('edit','Editar')} />
        </MenuItem>
        <MenuItem onClick={requestDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary={t('delete','Eliminar')} />
        </MenuItem>
      </Menu>

      <Dialog open={!!deleteTarget} onClose={() => (!deleting && setDeleteTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle>{t('delete','Eliminar')}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">{t('delete_confirm','¿Eliminar este personaje?')}{' '}<strong>{deleteTarget?.name}</strong></Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>{t('cancel','Cancelar')}</Button>
          <Button color="error" variant="contained" startIcon={<DeleteIcon />} onClick={confirmDelete} disabled={deleting}>
            {deleting ? t('deleting','Eliminando...') : t('delete','Eliminar')}
          </Button>
        </DialogActions>
      </Dialog>

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
