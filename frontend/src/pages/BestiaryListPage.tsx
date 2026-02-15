import { useParams } from 'react-router-dom';
import { Container, Typography, Alert } from '@mui/material';
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
  const defaultManual = 'dnd5e-2014';
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
