import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiBase';

export interface Invitation {
  id: string;
  campaign: {
    id: string;
    name: string;
    imageUrl?: string;
    owner: { id: number; username: string };
  };
  status: 'invited' | 'active' | 'declined';
}

export function useInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper para auth
  function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/campaigns/invitations/pending`, {
        headers: getAuthHeaders(),
      });
      console.log('DEBUG: /campaigns/invitations/pending response', res.data);
      setInvitations(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error loading invitations');
    } finally {
      setLoading(false);
    }
  }, []);

  const respond = useCallback(async (invitationId: string, response: 'accept' | 'decline') => {
    setError(null);
    try {
      await axios.post(`${API_BASE_URL}/campaigns/invitation/respond`, { invitationId, response }, {
        headers: getAuthHeaders(),
      });
      await fetchInvitations();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error updating invitation');
    }
  }, [fetchInvitations]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  return {
    invitations,
    loading,
    error,
    accept: (id: string) => respond(id, 'accept'),
    decline: (id: string) => respond(id, 'decline'),
    refresh: fetchInvitations,
  };
}
