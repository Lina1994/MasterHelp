import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Typography, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ManualBestiaryBrowser from '../components/manuals/ManualBestiaryBrowser';

interface BestiaryListPageProps {
  manualId?: string;
}

/**
 * BestiaryListPage - Vista del bestiario de manuales
 * Usado tanto como página standalone como embebido en ManualViewerPage
 */
export default function BestiaryListPage({ manualId: manualIdProp }: BestiaryListPageProps = {}) {
  const { manualId: manualIdParam } = useParams<{ manualId?: string }>();
  const { i18n } = useTranslation();
  const lang: 'en' | 'es' = (i18n.language?.slice(0, 2) === 'es' ? 'es' : 'en');
  // When the app language is Spanish we route to the SRD 5.2 manual because
  // that's where the official Spanish SRD translations live; otherwise
  // fall back to the SRD 5.1 English manual.
  const defaultManual = useMemo(
    () => (lang === 'es' ? 'dnd5e-2024' : 'dnd5e-2014'),
    [lang],
  );
  const effectiveManualId = manualIdProp || manualIdParam || defaultManual;

  return (
    <Container maxWidth="lg" sx={{ py: manualIdProp || manualIdParam ? 0 : 3 }}>
      {!manualIdProp && !manualIdParam && (
        <>
          <Typography variant="h4" gutterBottom>Bestiary</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Explorando monstruos del manual {defaultManual}
          </Alert>
        </>
      )}
      <ManualBestiaryBrowser manualId={effectiveManualId} />
    </Container>
  );
}
