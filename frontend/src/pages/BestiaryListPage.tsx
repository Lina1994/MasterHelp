import { useEffect, useMemo, useState } from 'react';
import { Box, Chip, Container, Dialog, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Pagination, Select, Stack, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { fetchMonster, fetchMonsters } from '../api/monsters';
import type { MonsterDetail, MonsterIndexItem } from '../types/monsters';
import MonsterStatBlock from '../components/bestiary/MonsterStatBlock';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

const PAGE_SIZE = 20;

export default function BestiaryListPage() {
  const { i18n } = useTranslation();
  const { manualId } = useParams<{ manualId: string }>();
  const [items, setItems] = useState<MonsterIndexItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [selected, setSelected] = useState<MonsterDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const pageSize = PAGE_SIZE;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  useEffect(() => {
    const lang = (i18n.language?.slice(0,2) === 'es' ? 'es' : 'en') as 'en' | 'es';
    const mid = manualId || 'dnd5e-2014';
    fetchMonsters(mid, { lang, q, type: type || undefined, page, pageSize })
      .then(({ items, total }) => { setItems(items); setTotal(total); })
      .catch(() => { setItems([]); setTotal(0); });
  }, [manualId, i18n.language, q, type, page]);

  const handleOpen = async (slug: string) => {
    setLoadingDetail(true);
    try {
      const lang = (i18n.language?.slice(0,2) === 'es' ? 'es' : 'en') as 'en' | 'es';
      const mid = manualId || 'dnd5e-2014';
      const detail = await fetchMonster(mid, slug, lang);
      setSelected(detail);
    } catch {
      setSelected(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>Bestiary</Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField label="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} size="small" />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="type-label">Type</InputLabel>
          <Select labelId="type-label" value={type} label="Type" onChange={(e) => setType(e.target.value)}>
            <MenuItem value=""><em>All</em></MenuItem>
            <MenuItem value="beast">Beast</MenuItem>
            <MenuItem value="fiend">Fiend</MenuItem>
            <MenuItem value="humanoid">Humanoid</MenuItem>
            <MenuItem value="undead">Undead</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Box>
        {items.map((m) => (
          <Box
            key={m.slug}
            sx={{ py: 1, borderBottom: '1px solid #eee', cursor: 'pointer' }}
            onClick={() => handleOpen(m.slug)}
          >
            <Typography variant="subtitle1" component="span">{m.name}</Typography>
            <Typography variant="caption" sx={{ ml: 1 }}>
              CR {m.challengeRating || '-'} • {m.size || '-'} {m.type || ''} {m.alignment ? `• ${m.alignment}` : ''}
            </Typography>
            {m.translated === false && (
              <Chip size="small" color="warning" label="EN" sx={{ ml: 1 }} />
            )}
          </Box>
        ))}
      </Box>

      <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
        <Pagination page={page} count={totalPages} onChange={(_, p) => setPage(p)} />
      </Stack>

      <Dialog open={!!selected || loadingDetail} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {selected?.name || (loadingDetail ? 'Loading…' : '')}
          <IconButton onClick={() => setSelected(null)} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selected ? (
            <MonsterStatBlock monster={selected} />
          ) : (
            <Typography variant="body2">{loadingDetail ? 'Cargando…' : 'No disponible'}</Typography>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
