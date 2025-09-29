import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import { useNavigate } from 'react-router-dom';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import axios from 'axios';
import API_BASE_URL from '../apiBase';

const DeleteAccountPage = () => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleDeleteAccount = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const token = localStorage.getItem('access_token');
  await axios.delete(`${API_BASE_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
  setMessage(t('delete_account_success'));
      localStorage.removeItem('access_token');
      setTimeout(() => navigate('/register'), 2000);
    } catch (err: any) {
  setError(err.response?.data?.message || t('delete_account_error'));
    } finally {
      setLoading(false);
      setOpenConfirm(false);
    }
  };

  const handleOpenConfirm = () => setOpenConfirm(true);
  const handleCloseConfirm = () => setOpenConfirm(false);

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            {t('delete_account_title')}
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center" gutterBottom>
            {t('delete_account_desc')}
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          <Button
            variant="contained"
            color="error"
            fullWidth
            onClick={handleOpenConfirm}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? t('delete') + '...' : t('delete_account')}
          </Button>

          <Dialog
            open={openConfirm}
            onClose={handleCloseConfirm}
            aria-labelledby="confirm-delete-title"
            aria-describedby="confirm-delete-description"
          >
            <DialogTitle id="confirm-delete-title">{t('delete_account_title')}</DialogTitle>
            <DialogContent>
              <DialogContentText id="confirm-delete-description">
                {t('delete_account_confirm')}
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseConfirm} color="primary" disabled={loading}>
                {t('cancel')}
              </Button>
              <Button onClick={handleDeleteAccount} color="error" disabled={loading} autoFocus>
                {loading ? t('delete') + '...' : t('delete')}
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Box>
    </Container>
  );
};

export default DeleteAccountPage;
