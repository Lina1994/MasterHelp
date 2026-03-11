import React, { useState } from 'react';
import { Box, Container, Tab, Tabs } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CharacterList } from '../components/characters/CharacterList';
import AffinityChart from '../components/characters/AffinityChart';
import CampaignClassesPage from './CampaignClassesPage';
import CampaignRacesPage from './CampaignRacesPage';
import CampaignSkillsPage from './CampaignSkillsPage';
import CampaignFeatsPage from './CampaignFeatsPage';
import CampaignTraitsPage from './CampaignTraitsPage';
import CampaignBackgroundsPage from './CampaignBackgroundsPage';

const CharactersPage: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={t('characters', 'Personajes')} />
          <Tab label={t('affinity_chart', 'Afinigrama')} />
          <Tab label={t('classes', 'Clases')} />
          <Tab label={t('races', 'Razas')} />
          <Tab label={t('skills', 'Habilidades')} />
          <Tab label={t('feats', 'Dotes')} />
          <Tab label={t('traits', 'Rasgos')} />
          <Tab label={t('backgrounds', 'Trasfondos')} />
        </Tabs>
      </Box>
      {tab === 0 && <CharacterList />}
      {tab === 1 && <AffinityChart />}
      {tab === 2 && <CampaignClassesPage />}
      {tab === 3 && <CampaignRacesPage />}
      {tab === 4 && <CampaignSkillsPage />}
      {tab === 5 && <CampaignFeatsPage />}
      {tab === 6 && <CampaignTraitsPage />}
      {tab === 7 && <CampaignBackgroundsPage />}
    </Container>
  );
};

export default CharactersPage;
