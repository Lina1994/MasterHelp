import { FC, useState } from 'react';
import { Box, TextField, Button, Stack, Alert } from '@mui/material';

interface CampaignInviteFormProps {
  onInvite: (email: string, username?: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

const CampaignInviteForm: FC<CampaignInviteFormProps> = ({ onInvite, loading, error }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    try {
      await onInvite(email, username);
      setSuccess('Invitación enviada');
      setEmail('');
      setUsername('');
    } catch {
      setSuccess('');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} alignItems="center">
        <TextField
          label="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          type="email"
          size="small"
        />
        <TextField
          label="o Usuario"
          value={username}
          onChange={e => setUsername(e.target.value)}
          size="small"
        />
        <Button type="submit" variant="contained" disabled={loading || (!email && !username)}>
          Invitar
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mt: 1 }}>{success}</Alert>}
    </Box>
  );
};

export default CampaignInviteForm;
