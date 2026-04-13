import { createHashRouter } from 'react-router-dom';
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
import SoundEffectsPage from '../pages/SoundEffectsPage';
import ManualsHomePage from '../pages/ManualsHomePage';
import ManualViewerPage from '../pages/ManualViewerPage';
import ClassPage from '../pages/ClassPage';
import MainLayout from '../layouts/MainLayout';
import SpellsPage from '../pages/SpellsPage';
import BestiaryListPage from '../pages/BestiaryListPage';
import BestiaryDetailPage from '../pages/BestiaryDetailPage';
import CampaignBestiaryPage from '../pages/CampaignBestiaryPage';
import CampaignSpellsPage from '../pages/CampaignSpellsPage';
import MapsPage from '../pages/MapsPage';
import ProjectionMapPage from '../pages/ProjectionMapPage';
import ProjectionSkylinePage from '../pages/ProjectionSkylinePage';
import CharactersPage from '../pages/CharactersPage';
import CharacterDetailPage from '../pages/CharacterDetailPage';
import CombatPage from '../pages/CombatPage';
import DiaryPage from '../pages/DiaryPage';
import QuestsPage from '../pages/QuestsPage';
import ShopsPage from '../pages/ShopsPage';
import WorldpediaPage from '../pages/WorldpediaPage';
import ManualEditorPage from '../pages/ManualEditorPage';
import ShortcutsPage from '../pages/ShortcutsPage';

const router = createHashRouter([
  // Ventana de proyección: ruta al margen del layout principal
  {
    path: '/projection/maps',
    element: <ProjectionMapPage />,
  },
  {
    path: '/projection/skyline',
    element: <ProjectionSkylinePage />,
  },
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
          { path: 'soundtrack/effects', element: <SoundEffectsPage /> },
          { path: 'maps', element: <MapsPage /> },
          { path: 'shortcuts', element: <ShortcutsPage /> },
          { path: 'combat', element: <CombatPage /> },
          { path: 'characters', element: <CharactersPage /> },
          { path: 'characters/:id', element: <CharacterDetailPage /> },
          { path: 'diary', element: <DiaryPage /> },
          { path: 'quests', element: <QuestsPage /> },
          { path: 'shops', element: <ShopsPage /> },
          { path: 'worldpedia', element: <WorldpediaPage /> },
          { path: 'campaign-bestiary', element: <CampaignBestiaryPage /> },
          { path: 'campaign-spells', element: <CampaignSpellsPage /> },
          { path: 'manuals/:manualId/edit', element: <ManualEditorPage /> },
          // ...other protected routes
        ],
      },
      // Nota: la ruta de proyección está definida a nivel raíz (fuera de MainLayout) más abajo
      // Public sections (do not require ProtectedLayout)
      {
        path: 'manuals',
        children: [
          { index: true, element: <ManualsHomePage /> },
          { path: ':manualId', element: <ManualViewerPage /> },
          { path: ':manualId/section/:nodeId', element: <ManualViewerPage /> },
          { path: ':manualId/classes/:id', element: <ClassPage /> },
          // Bestiary se sirve via la ruta genérica de sección: :manualId/section/:nodeId (nodeId=bestiary)
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