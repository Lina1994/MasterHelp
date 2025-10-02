import { RouterProvider } from 'react-router-dom';
import router from './router';
import { CampaignsProvider } from './components/Campaign/CampaignContext';
import { ActiveCampaignProvider } from './components/Campaign/ActiveCampaignContext';

function App() {
  return (
    <CampaignsProvider>
      <ActiveCampaignProvider>
        <RouterProvider
          router={router}
          future={{ v7_startTransition: true }}
        />
      </ActiveCampaignProvider>
    </CampaignsProvider>
  );
}

export default App;