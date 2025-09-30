import axios from 'axios';
import API_BASE_URL from '../apiBase';
import { User } from '../types';

export async function fetchUserFromApi(token: string): Promise<User | null> {
  try {
    const res = await axios.get(`${API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data as User;
  } catch {
    return null;
  }
}
