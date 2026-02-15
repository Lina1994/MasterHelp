import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Typography, Alert, CircularProgress, Box, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { fetchMonster } from '../api/monsters';
import MonsterStatBlock from '../components/bestiary/MonsterStatBlock';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

/**
 * BestiaryDetailPage - Vista de detalle de un monstruo de manual
 * Acceso directo a través de /bestiary/:manualId/:slug
 */
export default function BestiaryDetailPage() {
  const { manualId = 'dnd5e-2014', slug } = useParams<{ manualId?: string; slug: string }>();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [monster, setMonster] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const lang = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en') as 'en' | 'es';
    setLoading(true);
    fetchMonster(manualId, slug, lang)
      .then(setMonster)
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [manualId, slug, i18n.language]);

  if (error) {
    return (
      <Container sx={{ py: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={() => navigate(-1)} startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>
          Volver
        </Button>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!monster) {
    return (
      <Container sx={{ py: 3 }}>
        <Typography>No se encontró el monstruo</Typography>
        <Button onClick={() => navigate(-1)} startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>
          Volver
        </Button>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 3 }}>
      <Button onClick={() => navigate(-1)} startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
        Volver
      </Button>
      <MonsterStatBlock monster={monster} />
    </Container>
  );
}
