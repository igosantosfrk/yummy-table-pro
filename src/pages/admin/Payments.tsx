import { Card, CardContent } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

const Payments = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-display font-bold">Financeiro</h1>
    <Card className="glass">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-muted-foreground">Em breve</p>
        <p className="text-sm text-muted-foreground">Relatórios financeiros e integração com Stripe</p>
      </CardContent>
    </Card>
  </div>
);

export default Payments;
