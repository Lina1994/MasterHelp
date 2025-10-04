import { useEffect, useMemo, useState } from 'react';
import { Box, Checkbox, Dialog, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, MenuItem, Stack, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { DataGrid, GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { api } from '../../apiBase';
import { useTranslation } from 'react-i18next';
import { SpellDetail, SpellSummary } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface SpellsBrowserProps {
  embedded?: boolean; // if true, use compact spacing
  title?: string; // optional custom title
}

export default function SpellsBrowser({ embedded, title }: SpellsBrowserProps) {
  const { i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SpellSummary[]>([]);
  const [selected, setSelected] = useState<SpellDetail | null>(null);
  const [levels, setLevels] = useState<number[]>([]);
  const [schools, setSchools] = useState<string[]>([]);
  const [level, setLevel] = useState<number | ''>('');
  const [school, setSchool] = useState<string>('');
  const [rowCount, setRowCount] = useState<number>(0);
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'name', sort: 'asc' }] as GridSortModel);
  const [onlyConcentration, setOnlyConcentration] = useState(false);
  const [onlyRitual, setOnlyRitual] = useState(false);

  const cols: GridColDef[] = useMemo(() => ([
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'level', headerName: 'Lvl', width: 70 },
    { field: 'school', headerName: 'School', width: 120 },
    { field: 'castingTime', headerName: 'Cast', width: 130 },
    { field: 'range', headerName: 'Range', width: 120 },
    { field: 'duration', headerName: 'Duration', width: 160 },
    { field: 'components', headerName: 'Comp.', width: 130 },
  ]), []);

  // Load meta (levels, schools)
  useEffect(() => {
    const lang = i18n.language?.slice(0,2) || 'en';
    api.get('/spells/meta/all', { params: { lang } })
      .then(r => { setLevels(r.data.levels || []); setSchools(r.data.schools || []); })
      .catch(() => { setLevels([]); setSchools([]); });
  }, [i18n.language]);

  // Load page
  useEffect(() => {
    const lang = i18n.language?.slice(0,2) || 'en';
    const sortBy = sortModel[0]?.field ?? 'name';
    const sortDir = (sortModel[0]?.sort ?? 'asc') as 'asc' | 'desc';
    api.get('/spells', {
      params: {
        search,
        level: level === '' ? undefined : level,
        school: school || undefined,
        concentration: onlyConcentration || undefined,
        ritual: onlyRitual || undefined,
        page: pagination.page + 1,
        pageSize: pagination.pageSize,
        sortBy,
        sortDir,
        lang,
      }
    })
      .then(r => { setRows(r.data.items); setRowCount(r.data.total); })
      .catch(() => { setRows([]); setRowCount(0); });
  }, [search, level, school, onlyConcentration, onlyRitual, pagination.page, pagination.pageSize, sortModel, i18n.language]);

  const onRowClick = async (id: string) => {
    const lang = i18n.language?.slice(0,2) || 'en';
    const r = await api.get(`/spells/${id}`, { params: { lang } });
    setSelected(r.data);
  };

  return (
    <Box>
      <Typography variant={embedded ? 'h5' : 'h4'} gutterBottom>{title || 'Spells'}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, school or component"
          fullWidth
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
        <TextField select label="Level" size="small" sx={{ minWidth: 120 }} value={level}
          onChange={(e) => setLevel(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <MenuItem value="">All</MenuItem>
          {levels.map(l => (<MenuItem key={l} value={l}>{l}</MenuItem>))}
        </TextField>
        <TextField select label="School" size="small" sx={{ minWidth: 160 }} value={school}
          onChange={(e) => setSchool(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {schools.map(s => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
        </TextField>
        <FormControlLabel
          control={<Checkbox size="small" checked={onlyConcentration} onChange={(e) => setOnlyConcentration(e.target.checked)} />}
          label="Concentration"
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={onlyRitual} onChange={(e) => setOnlyRitual(e.target.checked)} />}
          label="Ritual"
        />
      </Stack>

      <Box sx={{ height: embedded ? 520 : 560, width: '100%' }}>
        <DataGrid
          density="compact"
          columns={cols}
          rows={rows}
          getRowId={(r: SpellSummary) => r.id}
          onRowDoubleClick={(p: any) => onRowClick(p.id as string)}
          onRowClick={(p: any) => onRowClick(p.id as string)}
          disableRowSelectionOnClick
          paginationMode="server"
          sortingMode="server"
          pageSizeOptions={[10, 25, 50, 100]}
          rowCount={rowCount}
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
        />
      </Box>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {selected?.name}
          <IconButton onClick={() => setSelected(null)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selected && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Level {selected.level} • {selected.school} • Cast: {selected.castingTime} • Range: {selected.range} • Duration: {selected.duration}
              </Typography>
              <Typography variant="body2" gutterBottom>Components: {selected.components}</Typography>
              {selected.classes?.length ? (
                <Typography variant="body2" gutterBottom>Classes: {selected.classes.join(', ')}</Typography>
              ) : null}
              {selected.description && (
                <Box sx={{ mt: 2 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.description}</ReactMarkdown>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
