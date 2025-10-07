import { useEffect, useState } from 'react';
import { Container, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { fetchMonster } from '../api/monsters';
import type { MonsterDetail } from '../types/monsters';
import MonsterStatBlock from '../components/bestiary/MonsterStatBlock';
import { useTranslation } from 'react-i18next';

export default function BestiaryDetailPage() {
  const { slug, manualId } = useParams<{ slug: string; manualId: string }>();
  const { i18n } = useTranslation();
  const [monster, setMonster] = useState<MonsterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const lang = (i18n.language?.slice(0,2) === 'es' ? 'es' : 'en') as 'en' | 'es';
    const mid = manualId || 'dnd5e-2014';
    fetchMonster(mid, slug, lang)
      .then(setMonster)
      .catch((e) => setError(e.message));
  }, [manualId, slug, i18n.language]);

  if (error) return <Container sx={{ py: 3 }}><Typography color="error">{error}</Typography></Container>;
  if (!monster) return <Container sx={{ py: 3 }}><Typography>Loading...</Typography></Container>;

  return (
    <Container sx={{ py: 3 }}>
      <MonsterStatBlock monster={monster} />
    </Container>
  );
}
