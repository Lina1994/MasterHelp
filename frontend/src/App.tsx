import { RouterProvider } from 'react-router-dom';
import router from './router';
import { CampaignsProvider } from './components/Campaign/CampaignContext';
import { ActiveCampaignProvider } from './components/Campaign/ActiveCampaignContext';
import { TimeOfDayProvider } from './components/player/TimeOfDayContext';
import { ActiveMapProvider } from './components/Map/ActiveMapContext';
import { ActiveEncounterProvider } from './components/Encounter/ActiveEncounterContext';

function App() {
  return (
    <CampaignsProvider>
      <ActiveCampaignProvider>
        <ActiveMapProvider>
          <ActiveEncounterProvider>
            <TimeOfDayProvider>
              <RouterProvider
                router={router}
                future={{ v7_startTransition: true }}
              />
            </TimeOfDayProvider>
          </ActiveEncounterProvider>
        </ActiveMapProvider>
      </ActiveCampaignProvider>
    </CampaignsProvider>
  );
}

export default App;