import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, DollarSign, TrendingUp, ShoppingCart, Percent } from 'lucide-react';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';

interface FinancialStats {
  totalRevenue: number;
  totalOrders: number;
  avgTicket: number;
  totalDeliveryFees: number;
  totalDiscount: number;
}

interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
}

const methodLabels: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  online: 'Online',
};

const Payments = () => {
  const { tenantId } = useAuth();
  const { preset, setPreset, dateRange, customRange, setCustomRange } = useDateRange('thisMonth');
  const [stats, setStats] = useState<FinancialStats>({ totalRevenue: 0, totalOrders: 0, avgTicket: 0, totalDeliveryFees: 0, totalDiscount: 0 });
  const [breakdown, setBreakdown] = useState<PaymentBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      const { data: orders } = await supabase
        .from('orders')
        .select('total, subtotal, delivery_fee, discount, payment_method, status')
        .eq('tenant_id', tenantId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());

      const valid = (orders || []).filter(o => o.status !== 'cancelled');
      const totalRevenue = valid.reduce((s, o) => s + Number(o.total), 0);
      const totalDeliveryFees = valid.reduce((s, o) => s + Number(o.delivery_fee), 0);
      const totalDiscount = valid.reduce((s, o) => s + Number(o.discount), 0);

      setStats({
        totalRevenue,
        totalOrders: valid.length,
        avgTicket: valid.length > 0 ? totalRevenue / valid.length : 0,
        totalDeliveryFees,
        totalDiscount,
      });

      const methodMap = new Map<string, PaymentBreakdown>();
      valid.forEach(o => {
        const m = o.payment_method;
        const existing = methodMap.get(m) || { method: m, count: 0, total: 0 };
        existing.count++;
        existing.total += Number(o.total);
        methodMap.set(m, existing);
      });
      setBreakdown(Array.from(methodMap.values()).sort((a, b) => b.total - a.total));
      setLoading(false);
    };
    load();
  }, [tenantId, dateRange.from.getTime(), dateRange.to.getTime()]);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const kpis = [
    { label: 'Receita Total', value: fmt(stats.totalRevenue), icon: DollarSign, color: 'text-success' },
    { label: 'Pedidos', value: stats.totalOrders.toString(), icon: ShoppingCart, color: 'text-primary' },
    { label: 'Ticket Médio', value: fmt(stats.avgTicket), icon: TrendingUp, color: 'text-accent' },
    { label: 'Taxas de Entrega', value: fmt(stats.totalDeliveryFees), icon: CreditCard, color: 'text-info' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-display font-bold">Financeiro</h1>
        <DateRangeFilter
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Card key={k.label} className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-bold">{k.value}</p>
                </div>
                <k.icon className={`h-5 w-5 ${k.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            Receita por Forma de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
          ) : breakdown.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">Nenhum pedido no período selecionado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">% Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.map(b => (
                  <TableRow key={b.method}>
                    <TableCell className="font-medium">{methodLabels[b.method] || b.method}</TableCell>
                    <TableCell className="text-right">{b.count}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{fmt(b.total)}</TableCell>
                    <TableCell className="text-right">
                      {stats.totalRevenue > 0 ? ((b.total / stats.totalRevenue) * 100).toFixed(1) : '0.0'}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Payments;
