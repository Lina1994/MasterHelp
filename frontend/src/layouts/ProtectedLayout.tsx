import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from './MainLayout'; // Importa tu layout principal

const ProtectedLayout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      // Si no hay token, redirige a login
      navigate('/login', { replace: true }); // `replace: true` evita que el usuario pueda volver atrás con el botón del navegador fácilmente
    }
  }, [navigate]);

  // Si hay token, renderiza el layout principal
  // Si no hay token, useEffect redirigirá, por lo que este return podría no ser visible
  const token = localStorage.getItem('access_token');
  if (token) {
    return <MainLayout />;
  } else {
    // Opcional: Mostrar un cargando mientras verifica
    return <div>Checking authentication...</div>;
  }
};

export default ProtectedLayout;