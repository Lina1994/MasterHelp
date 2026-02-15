import { useEffect, useState } from 'react';
import { Container, Typography, Alert, CircularProgress, Box } from '@mui/material';
import { useParams } from 'react-router-dom';
import { getCampaignMonster, type CampaignMonsterDetail } from '../api/bestiary/bestiaryApi';
import MonsterStatBlock from '../components/bestiary/MonsterStatBlock';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';

export default function CampaignBestiaryDetailPage() {
  const { monsterId } = useParams<{ monsterId: string }>();
  const { i18n } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id || null;
  const [monster, setMonster] = useState<CampaignMonsterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!monsterId || !campaignId) return;
    const lang = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en') as 'en' | 'es';
    setLoading(true);
    getCampaignMonster(campaignId, monsterId, lang)
      .then(setMonster)
      .catch((e) => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [campaignId, monsterId, i18n.language]);

  if (!campaignId) {
    return (
      <Container sx={{ py: 3 }}>
        <Alert severity="info">Selecciona una campaña para ver detalles del bestiario.</Alert>
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 3 }}>
        <Alert severity="error">{error}</Alert>
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
      </Container>
    );
  }

  return (
    <Container sx={{ py: 3 }}>
      <MonsterStatBlock monster={monster} />
    </Container>
  );
}
