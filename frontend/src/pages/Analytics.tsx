
import { Card, CardContent, Typography } from '@mui/material';
import Layout from '../components/Layout';

export default function Analytics() {
  return (
    <Layout title="Analytics">
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Portfolio Analytics
          </Typography>
          <Typography variant="body1" color="textSecondary">
            This page will display advanced analytics and insights about your portfolio performance.
          </Typography>
        </CardContent>
      </Card>
    </Layout>
  );
} 