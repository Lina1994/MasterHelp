import { Box, Breadcrumbs, Container, Link, Skeleton, Typography } from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../apiBase';
import { CharacterClass } from '../types';
import ClassSpellcastingTable from '../components/classes/ClassSpellcastingTable';

/**
 * Class detail page that fetches and displays a class progression, including spell slots and cantrips.
 * Backend endpoint: GET /manuals/:manualId/classes/:id?lang=xx
 */
export default function ClassPage() {
  const { manualId = 'dnd5e-2014', id } = useParams();
  const { i18n } = useTranslation();
  const [data, setData] = useState<CharacterClass | null>(null);
  const [loading, setLoading] = useState(true);

  const lang = useMemo(() => (i18n.language?.slice(0,2) || 'en') as 'en'|'es', [i18n.language]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/manuals/${manualId}/classes/${id}`, { params: { lang } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [manualId, id, lang]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Skeleton variant="text" width={260} height={40} />
        <Skeleton variant="rectangular" height={320} />
      </Container>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h6">Class not found</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/manuals">Manuals</Link>
        <Link component={RouterLink} to={`/manuals/${manualId}`}>{manualId}</Link>
        <Typography color="text.primary">{data.name}</Typography>
      </Breadcrumbs>

      <Typography variant="h4" gutterBottom>{data.name}</Typography>
      {data.hitDie ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Hit Die: d{data.hitDie}</Typography>
      ) : null}

      <Box>
        <ClassSpellcastingTable data={data} />
      </Box>
    </Container>
  );
}
