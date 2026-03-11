import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Megaphone } from 'lucide-react';
import type { CampaignSale } from '@/hooks/useDashboardData';

interface Props {
  data: CampaignSale[];
  loading: boolean;
}

export default function CampaignSalesChart({ data, loading }: Props) {
  const chartData = data.slice(0, 8).map(c => ({
    name: c.campaign.length > 20 ? c.campaign.slice(0, 18) + '…' : c.campaign,
    fullName: c.campaign,
    receita: c.revenue,
    pedidos: c.orders,
    fonte: c.source,
  }));

  return (
    <Card className="glass border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          Vendas por Campanha
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
              <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                formatter={(value: number, name: string) => [
                  name === 'receita' ? `R$ ${value.toFixed(2)}` : value,
                  name === 'receita' ? 'Receita' : 'Pedidos'
                ]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
              />
              <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
            {loading ? 'Carregando...' : 'Sem dados de campanha'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
