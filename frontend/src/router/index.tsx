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
]);

export default router;