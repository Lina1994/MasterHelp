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

export default API_BASE_URL;
