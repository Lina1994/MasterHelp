import axios from 'axios';

// Detecta automáticamente el host y usa el puerto 3000 para el backend
// Permite sobrescribir con variable de entorno VITE_API_BASE_URL si se desea

interface ImportMetaEnv {
	VITE_API_BASE_URL?: string;
}
interface ImportMeta {
	env: ImportMetaEnv;
}

const API_BASE_URL =
	(import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
	`${window.location.protocol}//${window.location.hostname}:3000`;

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Inyecta automáticamente el token en cada request y gestiona 401/403 globalmente
let isLoggingOut = false;

api.interceptors.request.use((config) => {
	try {
		const token = localStorage.getItem('access_token');
		if (token) {
			config.headers = config.headers || {};
			if (!('Authorization' in config.headers)) {
				(config.headers as any)['Authorization'] = `Bearer ${token}`;
			}
		}
	} catch {}
	return config;
});

api.interceptors.response.use(
	(res) => res,
	(error) => {
		const status = error?.response?.status;
		if ((status === 401 || status === 403) && !isLoggingOut) {
			isLoggingOut = true;
			try {
				localStorage.removeItem('access_token');
				localStorage.removeItem('current_user');
				localStorage.removeItem('activeCampaignId');
			} catch {}
			// Redirige a login de forma segura
			if (typeof window !== 'undefined') {
				window.location.href = '/login';
			}
		}
		return Promise.reject(error);
	}
);

export default API_BASE_URL;
