
import { Card, CardContent, Typography } from '@mui/material';
import Layout from '../components/Layout';

export default function Settings() {
  return (
    <Layout title="Settings">
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Application Settings
          </Typography>
          <Typography variant="body1" color="textSecondary">
            This page will allow you to configure application settings and preferences.
          </Typography>
        </CardContent>
      </Card>
    </Layout>
  );
} 