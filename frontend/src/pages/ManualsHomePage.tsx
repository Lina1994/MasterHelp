import { useEffect, useState } from 'react';
import { api } from '../apiBase';
import { Box, Grid, Card, CardActionArea, CardContent, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface ManualSummaryDto {
  id: string;
  title: string;
  version?: string;
  licenseName?: string;
}

export default function ManualsHomePage() {
  const [list, setList] = useState<ManualSummaryDto[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/manuals').then(r => setList(r.data)).catch(() => setList([]));
  }, []);

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom>Manuales</Typography>
      <Grid container spacing={2} columns={12}>
        {list.map(m => (
          <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined">
              <CardActionArea onClick={() => navigate(`/manuals/${m.id}`)}>
                <CardContent>
                  <Typography variant="h6">{m.title}</Typography>
                  <Typography variant="body2" color="text.secondary">Versión {m.version} · {m.licenseName}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
