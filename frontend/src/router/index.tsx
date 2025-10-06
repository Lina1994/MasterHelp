import { createBrowserRouter } from 'react-router-dom';
import ProtectedLayout from '../layouts/ProtectedLayout'; // Importa el nuevo layout protegido
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage'; // Importa la nueva página
import ResetPasswordPage from '../pages/ResetPasswordPage'; // Importa la nueva página
import ChangePasswordPage from '../pages/ChangePasswordPage'; // Importa la nueva página
import DeleteAccountPage from '../pages/DeleteAccountPage';
import CampaignPage from '../pages/CampaignPage';
import SoundtrackPage from '../pages/SoundtrackPage'; // Nueva página soundtrack
import ManualsHomePage from '../pages/ManualsHomePage';
import ManualViewerPage from '../pages/ManualViewerPage';
import ClassPage from '../pages/ClassPage';
import MainLayout from '../layouts/MainLayout';
import SpellsPage from '../pages/SpellsPage';

const router = createBrowserRouter([
  // Single top-level layout so GlobalPlayer stays mounted across all app pages
  {
    path: '/',
    element: <MainLayout />,
    children: [
      // Auth-protected section wraps its children and performs checks
      {
        element: <ProtectedLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'change-password', element: <ChangePasswordPage /> },
          { path: 'delete-account', element: <DeleteAccountPage /> },
          { path: 'campaigns', element: <CampaignPage /> },
          { path: 'soundtrack', element: <SoundtrackPage /> },
          // ...other protected routes
        ],
      },
      // Public sections (do not require ProtectedLayout)
      {
        path: 'manuals',
        children: [
          { index: true, element: <ManualsHomePage /> },
          { path: ':manualId', element: <ManualViewerPage /> },
          { path: ':manualId/section/:nodeId', element: <ManualViewerPage /> },
          { path: ':manualId/classes/:id', element: <ClassPage /> },
        ],
      },
      // Public spells browser
      {
        path: 'spells',
        children: [
          { index: true, element: <SpellsPage /> },
        ],
      },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/forgot-password', // Nueva ruta
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password', // Nueva ruta
    element: <ResetPasswordPage />,
  },
]);

export default router;