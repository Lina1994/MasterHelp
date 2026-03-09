import React, { useState } from 'react';
import { Box, Container, Tab, Tabs } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CharacterList } from '../components/characters/CharacterList';
import CampaignClassesPage from './CampaignClassesPage';
import CampaignRacesPage from './CampaignRacesPage';
import CampaignSkillsPage from './CampaignSkillsPage';
import CampaignFeatsPage from './CampaignFeatsPage';
import CampaignTraitsPage from './CampaignTraitsPage';

const CharactersPage: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={t('characters', 'Personajes')} />
          <Tab label={t('classes', 'Clases')} />
          <Tab label={t('races', 'Razas')} />
          <Tab label={t('skills', 'Habilidades')} />
          <Tab label={t('feats', 'Dotes')} />
          <Tab label={t('traits', 'Rasgos')} />
        </Tabs>
      </Box>
      {tab === 0 && <CharacterList />}
      {tab === 1 && <CampaignClassesPage />}
      {tab === 2 && <CampaignRacesPage />}
      {tab === 3 && <CampaignSkillsPage />}
      {tab === 4 && <CampaignFeatsPage />}
      {tab === 5 && <CampaignTraitsPage />}
    </Container>
  );
};

export default CharactersPage;
