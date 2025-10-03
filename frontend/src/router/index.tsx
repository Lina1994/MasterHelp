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
import MainLayout from '../layouts/MainLayout';
import SpellsPage from '../pages/SpellsPage';

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      // Ruta protegida para cambiar contraseña
      {
        path: 'change-password', // Ejemplo: /change-password
        element: <ChangePasswordPage />,
      },
      // Ruta protegida para eliminar cuenta
      {
        path: 'delete-account',
        element: <DeleteAccountPage />,
      },
      // Ruta protegida para campañas
      {
        path: 'campaigns',
        element: <CampaignPage />,
      },
      {
        path: 'soundtrack',
        element: <SoundtrackPage />,
      },
      // Puedes añadir más rutas protegidas aquí
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
  // Rutas públicas para Manuales, envueltas en MainLayout para mantener sidebar
  {
    path: '/manuals',
    element: <MainLayout />,
    children: [
      { index: true, element: <ManualsHomePage /> },
      { path: ':manualId', element: <ManualViewerPage /> },
      { path: ':manualId/section/:nodeId', element: <ManualViewerPage /> },
    ],
  },
  // Ruta pública para Hechizos
  {
    path: '/spells',
    element: <MainLayout />,
    children: [
      { index: true, element: <SpellsPage /> },
    ],
  },
]);

export default router;