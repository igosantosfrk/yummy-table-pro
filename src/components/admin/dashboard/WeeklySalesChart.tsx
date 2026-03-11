import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { WeeklySale } from '@/hooks/useDashboardData';

interface Props {
  data: WeeklySale[];
  loading: boolean;
}

export default function WeeklySalesChart({ data, loading }: Props) {
  return (
    <Card className="glass border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Vendas da Semana
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                formatter={(value: number, name: string) => [
                  name === 'receita' ? `R$ ${value.toFixed(2)}` : value,
                  name === 'receita' ? 'Receita' : 'Pedidos'
                ]}
              />
              <Bar dataKey="pedidos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="receita" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
            {loading ? 'Carregando...' : 'Sem dados'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
