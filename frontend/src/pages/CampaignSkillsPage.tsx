import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Container,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Pagination,
  Paper, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import { getCurrentUser } from '../utils/getCurrentUser';
import {
  listCampaignSkills, getCampaignSkill, createCampaignSkill,
  updateCampaignSkill, deleteCampaignSkill, copySkillFromManual,
  type CampaignSkillListItem, type CampaignSkillDetail,
} from '../api/skills/skillsApi';
import EditSkillDialog from '../components/skills/EditSkillDialog';

const PAGE_SIZE = 20;

function isUserMaster(activeCampaign: any, userId: number | undefined): boolean {
  if (!activeCampaign?.id || !userId) return false;
  if (activeCampaign?.owner?.id === userId) return true;
  return !!activeCampaign?.players?.some(
    (p: any) => p?.user?.id === userId && p?.status === 'active' && p?.role === 'master',
  );
}

const ABILITY_OPTIONS = [
  { value: 'str', label: 'STR' },
  { value: 'dex', label: 'DEX' },
  { value: 'con', label: 'CON' },
  { value: 'int', label: 'INT' },
  { value: 'wis', label: 'WIS' },
  { value: 'cha', label: 'CHA' },
];

/**
 * Campaign Skills page – lists manual + campaign skills with filters, detail view, and CRUD.
 */
export default function CampaignSkillsPage() {
  const { t, i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const currentUserId = getCurrentUser()?.id as number | undefined;
  const isMaster = isUserMaster(activeCampaign, currentUserId);
  const lang = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en') as 'en' | 'es';

  const [items, setItems] = useState<CampaignSkillListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [ability, setAbility] = useState('');
  const [origin, setOrigin] = useState('');
  const [sort, setSort] = useState<string>('name');
  const [selected, setSelected] = useState<CampaignSkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editingSkill, setEditingSkill] = useState<CampaignSkillDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const pageSize = PAGE_SIZE;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  const loadSkills = async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listCampaignSkills(
        campaignId,
        { q: q || undefined, ability: ability || undefined, origin: origin || undefined, sort: sort as any || undefined, page, pageSize },
        lang,
      );
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error cargando habilidades');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSkills(); }, [campaignId, q, ability, origin, sort, page, lang]);

  const handleOpenDetail = async (skillId: string) => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const detail = await getCampaignSkill(campaignId, skillId, lang);
      setSelected(detail);
    } catch { setSelected(null); }
    finally { setLoading(false); }
  };

  const handleDelete = async (skillId: string) => {
    if (!campaignId) return;
    try {
      await deleteCampaignSkill(campaignId, skillId);
      setDeleteConfirm(null);
      loadSkills();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error eliminando habilidad');
    }
  };

  const handleOpenCreate = () => { setIsCreating(true); setEditingSkill(null); setEditDialog(true); };

  const handleOpenEdit = async (skillId: string) => {
    if (!campaignId) return;
    try {
      const detail = await getCampaignSkill(campaignId, skillId, lang);
      setIsCreating(false);
      setEditingSkill(detail);
      setEditDialog(true);
    } catch { setError('Error cargando habilidad para editar'); }
  };

  const handleCloseEdit = () => { setEditDialog(false); setEditingSkill(null); setIsCreating(false); };

  const handleSave = async (data: any) => {
    if (!campaignId) return;
    if (isCreating) {
      await createCampaignSkill(campaignId, data);
    } else if (editingSkill) {
      if (editingSkill.origin === 'manual' && editingSkill.sourceManual) {
        const [manualId, skillId] = editingSkill.id.split(':');
        if (manualId && skillId) {
          const copied = await copySkillFromManual(campaignId, manualId, skillId, lang);
          await updateCampaignSkill(campaignId, copied.id, data);
        }
      } else {
        await updateCampaignSkill(campaignId, editingSkill.id, data);
      }
    }
    loadSkills();
  };

  const getManualName = (manualId: string | null | undefined): string => {
    if (!manualId) return 'Manual';
    if (manualId === 'dnd5e-2014') return 'D&D 5e (2014)';
    if (manualId === 'dnd5e-2024') return 'D&D 5e (2024)';
    return manualId.split('-').map((p) => p.toUpperCase()).join(' ');
  };

  const originLabel = (o: string, src?: string | null, custom?: string | null) => {
    switch (o) {
      case 'manual': return getManualName(src);
      case 'manual-edited': return `${getManualName(src)} (${t('edited', 'Editado')})`;
      case 'homebrew': return custom || 'Homebrew';
      default: return o;
    }
  };

  const originChipColor = (o: string): 'default' | 'primary' | 'secondary' =>
    o === 'manual-edited' ? 'secondary' : o === 'homebrew' ? 'primary' : 'default';

  const handleClearFilters = () => { setQ(''); setAbility(''); setOrigin(''); setSort('name'); setPage(1); };
  const hasActiveFilters = q || ability || origin || sort !== 'name';

  if (!campaignId) return <Container sx={{ py: 3 }}><Alert severity="info">{t('select_campaign_skills', 'Selecciona una campaña para ver las habilidades.')}</Alert></Container>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5">{t('skills', 'Habilidades')}</Typography>
        {isMaster && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            {t('add_skill', 'Añadir Habilidad')}
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          <TextField label={t('search', 'Buscar')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} size="small" sx={{ flexGrow: 1, minWidth: 200 }} />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{t('ability', 'Característica')}</InputLabel>
            <Select value={ability} label={t('ability', 'Característica')} onChange={(e) => { setAbility(e.target.value); setPage(1); }}>
              <MenuItem value=""><em>{t('all', 'Todos')}</em></MenuItem>
              {ABILITY_OPTIONS.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('origin', 'Origen')}</InputLabel>
            <Select value={origin} label={t('origin', 'Origen')} onChange={(e) => { setOrigin(e.target.value); setPage(1); }}>
              <MenuItem value=""><em>{t('all', 'Todos')}</em></MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
              <MenuItem value="manual-edited">Manual ({t('edited', 'Editado')})</MenuItem>
              <MenuItem value="homebrew">Homebrew</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('sort', 'Ordenar por')}</InputLabel>
            <Select value={sort} label={t('sort', 'Ordenar por')} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <MenuItem value="name">{t('name_az', 'Nombre (A-Z)')}</MenuItem>
              <MenuItem value="name_desc">{t('name_za', 'Nombre (Z-A)')}</MenuItem>
              <MenuItem value="ability">{t('ability_asc', 'Característica (A-Z)')}</MenuItem>
              <MenuItem value="ability_desc">{t('ability_desc_label', 'Característica (Z-A)')}</MenuItem>
            </Select>
          </FormControl>
          {hasActiveFilters && (
            <Button variant="outlined" size="small" startIcon={<FilterListOffIcon />} onClick={handleClearFilters}>
              {t('clear_filters', 'Limpiar Filtros')}
            </Button>
          )}
        </Stack>
      </Paper>

      {loading && !items.length ? (
        <Typography>{t('loading', 'Cargando...')}</Typography>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2, mb: 3 }}>
            {items.map((skill) => (
              <Card key={skill.id}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{skill.name}</Typography>
                  <Chip label={skill.ability?.toUpperCase()} size="small" variant="outlined" sx={{ mr: 1 }} />
                  <Chip label={originLabel(skill.origin, skill.sourceManual, skill.customOriginName)} size="small" color={originChipColor(skill.origin)} />
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Tooltip title={t('view_details', 'Ver detalles')}>
                      <IconButton size="small" onClick={() => handleOpenDetail(skill.id)}><VisibilityIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    {isMaster && (
                      <Tooltip title={t('edit', 'Editar')}>
                        <IconButton size="small" onClick={() => handleOpenEdit(skill.id)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {isMaster && skill.isCustom && (
                      <Tooltip title={t('delete', 'Eliminar')}>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(skill.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
          {!loading && items.length === 0 && <Alert severity="info">{t('no_skills_found', 'No se encontraron habilidades')}</Alert>}
          <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
            <Pagination page={page} count={totalPages} onChange={(_, p) => setPage(p)} />
          </Stack>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {selected?.name}
          <IconButton onClick={() => setSelected(null)} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Box>
              <Chip label={selected.ability?.toUpperCase()} size="small" variant="outlined" sx={{ mb: 2 }} />
              <Typography variant="body1" whiteSpace="pre-wrap">{selected.description}</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>{t('confirm_delete', '¿Confirmar eliminación?')}</DialogTitle>
        <DialogContent><Typography>{t('delete_skill_confirm', '¿Estás seguro de que quieres eliminar esta habilidad?')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>{t('cancel', 'Cancelar')}</Button>
          <Button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} color="error" autoFocus>{t('delete', 'Eliminar')}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit/Create Dialog */}
      <EditSkillDialog
        open={editDialog}
        skillData={editingSkill}
        isCreate={isCreating}
        onClose={handleCloseEdit}
        onSave={handleSave}
      />
    </Box>
  );
}
