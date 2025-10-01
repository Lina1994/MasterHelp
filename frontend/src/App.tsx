import { RouterProvider } from 'react-router-dom';
import router from './router';
import { CampaignsProvider } from './components/Campaign/CampaignContext';

function App() {
  return (
    <CampaignsProvider>
      <RouterProvider
        router={router}
        future={{ v7_startTransition: true }}
      />
    </CampaignsProvider>
  );
}

export default App;
