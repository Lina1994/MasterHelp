import { User } from '../types';

export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem('current_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}
