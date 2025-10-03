import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from './MainLayout';
import { api } from '../apiBase';

interface AuthState {
  checking: boolean;
  valid: boolean;
}

const ProtectedLayout = () => {
  const navigate = useNavigate();
  const [auth, setAuth] = useState<AuthState>({ checking: true, valid: false });

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    (async () => {
      try {
        await api.get('/users/me');
        if (!cancelled) setAuth({ checking: false, valid: true });
      } catch (e: any) {
        // Si backend caído (ERR_CONNECTION_REFUSED) o 401 -> limpiar y enviar a login
        if (!cancelled) {
          try {
            localStorage.removeItem('access_token');
            localStorage.removeItem('current_user');
            localStorage.removeItem('activeCampaignId');
          } catch {}
          navigate('/login', { replace: true });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  if (auth.checking) {
    return <div style={{ padding: 24 }}>Comprobando sesión...</div>;
  }
  if (!auth.valid) {
    return <div style={{ padding: 24 }}>Redirigiendo...</div>; // Breve estado transitorio
  }
  return <MainLayout />;
};

export default ProtectedLayout;