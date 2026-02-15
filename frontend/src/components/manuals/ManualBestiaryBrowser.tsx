import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, CardMedia, Chip, Dialog, DialogContent, DialogTitle, FormControl,
  Grid, IconButton, InputLabel, MenuItem, Pagination, Paper, Select, Stack, TextField, Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { fetchMonsters, fetchMonster } from '../../api/monsters';
import type { MonsterDetail, MonsterIndexItem } from '../../types/monsters';
import MonsterStatBlock from '../bestiary/MonsterStatBlock';

interface ManualBestiaryBrowserProps {
  manualId: string;
}

const PAGE_SIZE = 20;

export default function ManualBestiaryBrowser({ manualId }: ManualBestiaryBrowserProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.slice(0, 2) || 'en') as 'en' | 'es';

  const [items, setItems] = useState<MonsterIndexItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [size, setSize] = useState('');
  const [selected, setSelected] = useState<MonsterDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchMonsters(manualId, {
      lang,
      q: q || undefined,
      type: type || undefined,
      size: size || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [manualId, q, type, size, page, lang]);

  const handleOpenDetail = async (slug: string) => {
    setLoading(true);
    try {
      const detail = await fetchMonster(manualId, slug, lang);
      setSelected(detail);
    } catch {
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          <TextField
            label={t('search', 'Buscar')}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            size="small"
            sx={{ flexGrow: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="type-label">{t('type', 'Tipo')}</InputLabel>
            <Select
              labelId="type-label"
              value={type}
              label={t('type', 'Tipo')}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
            >
              <MenuItem value=""><em>{t('all', 'Todos')}</em></MenuItem>
              <MenuItem value="aberration">Aberration</MenuItem>
              <MenuItem value="beast">Beast</MenuItem>
              <MenuItem value="celestial">Celestial</MenuItem>
              <MenuItem value="construct">Construct</MenuItem>
              <MenuItem value="dragon">Dragon</MenuItem>
              <MenuItem value="elemental">Elemental</MenuItem>
              <MenuItem value="fey">Fey</MenuItem>
              <MenuItem value="fiend">Fiend</MenuItem>
              <MenuItem value="giant">Giant</MenuItem>
              <MenuItem value="humanoid">Humanoid</MenuItem>
              <MenuItem value="monstrosity">Monstrosity</MenuItem>
              <MenuItem value="ooze">Ooze</MenuItem>
              <MenuItem value="plant">Plant</MenuItem>
              <MenuItem value="undead">Undead</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="size-label">{t('size', 'Tamaño')}</InputLabel>
            <Select
              labelId="size-label"
              value={size}
              label={t('size', 'Tamaño')}
              onChange={(e) => { setSize(e.target.value); setPage(1); }}
            >
              <MenuItem value=""><em>{t('all', 'Todos')}</em></MenuItem>
              <MenuItem value="Tiny">Tiny</MenuItem>
              <MenuItem value="Small">Small</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Large">Large</MenuItem>
              <MenuItem value="Huge">Huge</MenuItem>
              <MenuItem value="Gargantuan">Gargantuan</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography>Cargando...</Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
            {items.map((monster) => (
              <Card key={monster.slug} sx={{ display: 'flex', flexDirection: 'column' }}>
                {monster.translated === false && (
                  <Box sx={{ bgcolor: 'warning.main', color: 'warning.contrastText', px: 1, py: 0.5 }}>
                    <Typography variant="caption">Not translated</Typography>
                  </Box>
                )}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="div" gutterBottom>
                    {monster.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    CR {monster.challengeRating || '?'} • {monster.size} {monster.type}
                  </Typography>
                  {monster.alignment && (
                    <Typography variant="caption" color="text.secondary">
                      {monster.alignment}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <IconButton size="small" onClick={() => handleOpenDetail(monster.slug)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>

          {!loading && items.length === 0 && (
            <Typography align="center" sx={{ py: 4 }}>{t('no_monsters_found', 'No se encontraron monstruos')}</Typography>
          )}

          <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
            <Pagination page={page} count={totalPages} onChange={(_, p) => setPage(p)} />
          </Stack>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {selected?.name}
          <IconButton onClick={() => setSelected(null)} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selected && <MonsterStatBlock monster={selected} />}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
