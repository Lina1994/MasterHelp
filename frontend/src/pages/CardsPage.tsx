import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AddCardIcon from '@mui/icons-material/AddCard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveCampaign } from '../components/Campaign/ActiveCampaignContext';
import {
  createCardTemplate,
  deleteCardTemplate,
  duplicateCardTemplate,
  listCardTemplates,
  updateCardTemplate,
} from '../api/cards/cardsApi';
import type { CardTemplate, CardTemplateInput } from '../types/cardTemplates';
import CardTemplateList from '../components/cards/CardTemplateList';
import CardTemplateEditorDialog from '../components/cards/CardTemplateEditorDialog';
import CharacterCardGeneratorDialog from '../components/cards/CharacterCardGeneratorDialog';

/**
 * Top-level page for the "Cartas" module. Renders a tabbed interface so
 * users can manage their templates and generate character cards from a
 * single entry point.
 */
export default function CardsPage() {
  const { t } = useTranslation();
  const { activeCampaign } = useActiveCampaign();
  const campaignId = activeCampaign?.id ?? null;

  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CardTemplate | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCardTemplates();
      setTemplates(data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('cards_load_error', 'No se pudieron cargar las plantillas.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleCreate = () => { setEditing(null); setEditorOpen(true); };
  const handleEdit = (tpl: CardTemplate) => { setEditing(tpl); setEditorOpen(true); };

  const handleSave = async (input: CardTemplateInput) => {
    try {
      if (editing) {
        await updateCardTemplate(editing.id, input);
      } else {
        await createCardTemplate(input);
      }
      setEditorOpen(false);
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('cards_save_error', 'No se pudo guardar la plantilla.'));
    }
  };

  const handleDelete = async (tpl: CardTemplate) => {
    try { await deleteCardTemplate(tpl.id); load(); } catch (e: any) { setError(e?.response?.data?.message ?? t('cards_delete_error', 'No se pudo eliminar la plantilla.')); }
  };

  const handleDuplicate = async (tpl: CardTemplate) => {
    try { await duplicateCardTemplate(tpl.id); load(); } catch (e: any) { setError(e?.response?.data?.message ?? t('cards_duplicate_error', 'No se pudo duplicar la plantilla.')); }
  };

  const handleUseStarter = async (input: CardTemplateInput, _label: string) => {
    try {
      await createCardTemplate(input);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('cards_save_error', 'No se pudo guardar la plantilla.'));
    }
  };

  const hasCampaign = !!campaignId;
  const templateCountLabel = useMemo(() => `${templates.length} ${templates.length === 1 ? 'plantilla' : 'plantillas'}`, [templates.length]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('cards', 'Cartas')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('cards_subtitle', 'Crea plantillas de cartas imprimibles y exporta tus rasgos, conjuros, dotes, fichas, objetos y monstruos a PDF.')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={templateCountLabel} size="small" />
          {!hasCampaign && (
            <Chip label={t('cards_no_campaign', 'Sin campaña activa')} color="warning" size="small" variant="outlined" />
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('cards_tab_templates', 'Plantillas')} />
        <Tab label={t('cards_tab_generator', 'Generador de personaje')} />
      </Tabs>

      {tab === 0 && (
        <CardTemplateList
          templates={templates}
          isBusy={loading}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onUseStarter={handleUseStarter}
        />
      )}

      {tab === 1 && (
        <Box>
          {!hasCampaign ? (
            <Alert severity="info">
              {t('cards_generator_campaign_required', 'Para generar cartas a partir de un personaje debes seleccionar una campaña activa. Crea o únete a una desde la barra lateral y vuelve aquí.')}
            </Alert>
          ) : templates.length === 0 ? (
            <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
              <AddCardIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Typography variant="h6">{t('cards_generator_no_templates_title', 'No tienes plantillas todavía')}</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {t('cards_generator_no_templates_hint', 'Crea al menos una plantilla en la pestaña "Plantillas" antes de generar cartas de personaje.')}
              </Typography>
              <Button variant="contained" startIcon={<AddCardIcon />} onClick={handleCreate}>
                {t('cards_generator_create_template', 'Crear mi primera plantilla')}
              </Button>
            </Stack>
          ) : (
            <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
              <Typography variant="h6">{t('cards_generator_ready_title', 'Genera cartas de un personaje')}</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {t('cards_generator_ready_hint', 'Elige un personaje y una plantilla para producir un PDF con una carta por cada rasgo, dote y conjuro seleccionados.')}
              </Typography>
              <Button variant="contained" size="large" onClick={() => setGeneratorOpen(true)}>
                {t('cards_generator_open', 'Abrir generador')}
              </Button>
            </Stack>
          )}
        </Box>
      )}

      <CardTemplateEditorDialog
        open={editorOpen}
        initial={editing}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        onSave={handleSave}
      />

      {campaignId && (
        <CharacterCardGeneratorDialog
          open={generatorOpen}
          onClose={() => setGeneratorOpen(false)}
          campaignId={campaignId}
          templates={templates}
        />
      )}
    </Container>
  );
}
