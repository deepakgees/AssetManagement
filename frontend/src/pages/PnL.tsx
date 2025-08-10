
import { Card, CardContent, Typography } from '@mui/material';
import Layout from '../components/Layout';

export default function PnL() {
  return (
    <Layout title="Profit & Loss">
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Profit & Loss Analysis
          </Typography>
          <Typography variant="body1" color="textSecondary">
            This page will display detailed profit and loss analysis across all your accounts.
          </Typography>
        </CardContent>
      </Card>
    </Layout>
  );
} 