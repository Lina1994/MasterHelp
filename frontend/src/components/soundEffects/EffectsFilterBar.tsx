import React from 'react';
import { Grid, TextField, Autocomplete } from '@mui/material';

interface EffectsFilterBarProps {
  q: string;
  onQChange: (value: string) => void;
  filterCategories: string[];
  onCategoriesChange: (values: string[]) => void;
  filterPublic: 'any' | 'true' | 'false';
  onPublicChange: (value: 'any' | 'true' | 'false') => void;
  sort: 'alpha' | 'alpha_desc' | 'size' | 'size_desc';
  onSortChange: (value: 'alpha' | 'alpha_desc' | 'size' | 'size_desc') => void;
  optionsCategories: string[];
}

export const EffectsFilterBar: React.FC<EffectsFilterBarProps> = ({
  q,
  onQChange,
  filterCategories,
  onCategoriesChange,
  filterPublic,
  onPublicChange,
  sort,
  onSortChange,
  optionsCategories,
}) => {
  return (
    <Grid container spacing={2} columns={12}>
      <Grid size={{ xs: 12, md: 4 }}>
        <TextField fullWidth size="small" label="Buscar" value={q} onChange={e => onQChange(e.target.value)} placeholder="Nombre o categoría" />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Autocomplete
          multiple
          size="small"
          options={optionsCategories}
          value={filterCategories}
          onChange={(_, v) => onCategoriesChange(v)}
          renderInput={(params) => <TextField {...params} label="Categoría" />}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 2 }}>
        <TextField fullWidth size="small" label="Público" value={filterPublic} onChange={e => onPublicChange(e.target.value as any)} select SelectProps={{ native: true }}>
          <option value="any">Todos</option>
          <option value="true">Sólo públicos</option>
          <option value="false">Sólo privados</option>
        </TextField>
      </Grid>
      <Grid size={{ xs: 12, md: 2 }}>
        <TextField fullWidth size="small" label="Orden" value={sort} onChange={e => onSortChange(e.target.value as any)} select SelectProps={{ native: true }}>
          <option value="alpha">Alfabético A-Z</option>
          <option value="alpha_desc">Alfabético Z-A</option>
          <option value="size">Tamaño ↑</option>
          <option value="size_desc">Tamaño ↓</option>
        </TextField>
      </Grid>
    </Grid>
  );
};
