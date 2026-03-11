import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ShoppingBag, DollarSign, Clock, TrendingUp, CheckCircle, XCircle, Truck, Package, Eye, MousePointerClick, BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardStats {
  ordersToday: number;
  revenue: number;
  preparing: number;
  outForDelivery: number;
  completed: number;
  cancelled: number;
  avgTicket: number;
  activeProducts: number;
}

interface UtmStats {
  source: string;
  views: number;
  orders: number;
  revenue: number;
}

interface PageViewStats {
  page_type: string;
  count: number;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const Dashboard = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    ordersToday: 0, revenue: 0, preparing: 0, outForDelivery: 0,
    completed: 0, cancelled: 0, avgTicket: 0, activeProducts: 0,
  });
  const [utmData, setUtmData] = useState<UtmStats[]>([]);
  const [pageViews, setPageViews] = useState<PageViewStats[]>([]);
  const [weeklyOrders, setWeeklyOrders] = useState<{ day: string; pedidos: number; receita: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.tenant_id) return;
    const tenantId = profile.tenant_id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const loadAll = async () => {
      // Orders today
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('id, total, status, created_at, utm_source')
        .eq('tenant_id', tenantId)
        .gte('created_at', todayISO);

      const orders = todayOrders || [];
      const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0);
      const preparing = orders.filter(o => o.status === 'preparing').length;
      const outForDelivery = orders.filter(o => o.status === 'out_for_delivery').length;
      const completed = orders.filter(o => o.status === 'completed').length;
      const cancelled = orders.filter(o => o.status === 'cancelled').length;
      const validOrders = orders.filter(o => o.status !== 'cancelled');
      const avgTicket = validOrders.length > 0 ? revenue / validOrders.length : 0;

      // Active products count
      const { count: activeProducts } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_available', true);

      setStats({
        ordersToday: orders.length,
        revenue,
        preparing,
        outForDelivery,
        completed,
        cancelled,
        avgTicket,
        activeProducts: activeProducts || 0,
      });

      // UTM Analytics - last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: utmViews } = await supabase
        .from('menu_page_views' as any)
        .select('utm_source, id')
        .eq('tenant_id', tenantId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('utm_source', 'is', null);

      const { data: utmOrders } = await supabase
        .from('orders')
        .select('utm_source, total')
        .eq('tenant_id', tenantId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('utm_source', 'is', null);

      // Group by utm_source
      const utmMap = new Map<string, UtmStats>();
      (utmViews as any[] || []).forEach((v: any) => {
        const src = v.utm_source || 'direto';
        const existing = utmMap.get(src) || { source: src, views: 0, orders: 0, revenue: 0 };
        existing.views++;
        utmMap.set(src, existing);
      });
      (utmOrders || []).forEach((o: any) => {
        const src = o.utm_source || 'direto';
        const existing = utmMap.get(src) || { source: src, views: 0, orders: 0, revenue: 0 };
        existing.orders++;
        existing.revenue += Number(o.total);
        utmMap.set(src, existing);
      });
      setUtmData(Array.from(utmMap.values()).sort((a, b) => b.revenue - a.revenue));

      // Page views by type - last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: pvData } = await supabase
        .from('menu_page_views' as any)
        .select('page_type')
        .eq('tenant_id', tenantId)
        .gte('created_at', sevenDaysAgo.toISOString());

      const pvMap = new Map<string, number>();
      (pvData as any[] || []).forEach((pv: any) => {
        pvMap.set(pv.page_type, (pvMap.get(pv.page_type) || 0) + 1);
      });
      setPageViews(Array.from(pvMap.entries()).map(([page_type, count]) => ({ page_type, count })));

      // Weekly orders (last 7 days)
      const weekData: { day: string; pedidos: number; receita: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);

        const { data: dayOrders } = await supabase
          .from('orders')
          .select('total, status')
          .eq('tenant_id', tenantId)
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString());

        const valid = (dayOrders || []).filter(o => o.status !== 'cancelled');
        weekData.push({
          day: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
          pedidos: (dayOrders || []).length,
          receita: valid.reduce((s, o) => s + Number(o.total), 0),
        });
      }
      setWeeklyOrders(weekData);
      setLoading(false);
    };

    loadAll();
  }, [profile?.tenant_id]);

  const pageTypeLabels: Record<string, string> = {
    menu_home: 'Página Inicial',
    category: 'Categorias',
    product: 'Produtos',
    add_to_cart: 'Add ao Carrinho',
    cart: 'Carrinho',
    checkout: 'Checkout',
  };

  const statCards = [
    { label: 'Pedidos Hoje', value: stats.ordersToday.toString(), icon: ShoppingBag, color: 'text-primary' },
    { label: 'Faturamento', value: `R$ ${stats.revenue.toFixed(2).replace('.', ',')}`, icon: DollarSign, color: 'text-success' },
    { label: 'Em Preparo', value: stats.preparing.toString(), icon: Clock, color: 'text-warning' },
    { label: 'Em Entrega', value: stats.outForDelivery.toString(), icon: Truck, color: 'text-info' },
    { label: 'Finalizados', value: stats.completed.toString(), icon: CheckCircle, color: 'text-success' },
    { label: 'Cancelados', value: stats.cancelled.toString(), icon: XCircle, color: 'text-destructive' },
    { label: 'Ticket Médio', value: `R$ ${stats.avgTicket.toFixed(2).replace('.', ',')}`, icon: TrendingUp, color: 'text-primary' },
    { label: 'Produtos Ativos', value: stats.activeProducts.toString(), icon: Package, color: 'text-accent' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Olá, {profile?.full_name?.split(' ')[0] || 'Admin'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Aqui está o resumo do seu restaurante hoje.
        </p>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statCards.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card className="glass hover:shadow-glow-sm transition-all duration-300 cursor-default">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Vendas da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyOrders.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeklyOrders}>
                  <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number, name: string) => [
                      name === 'receita' ? `R$ ${value.toFixed(2)}` : value,
                      name === 'receita' ? 'Receita' : 'Pedidos'
                    ]}
                  />
                  <Bar dataKey="pedidos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="receita" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {loading ? 'Carregando...' : 'Nenhum dado disponível'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Funil do Cardápio (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pageViews.length > 0 ? (
              <div className="space-y-3">
                {pageViews
                  .sort((a, b) => b.count - a.count)
                  .map((pv, i) => {
                    const maxCount = pageViews[0]?.count || 1;
                    const pct = (pv.count / maxCount) * 100;
                    return (
                      <div key={pv.page_type} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{pageTypeLabels[pv.page_type] || pv.page_type}</span>
                          <span className="font-semibold">{pv.count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {loading ? 'Carregando...' : 'Nenhuma visualização registrada'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* UTM Analytics */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <MousePointerClick className="h-5 w-5 text-primary" />
            Rastreamento de Campanhas (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {utmData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Fonte (UTM Source)</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Visualizações</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Pedidos</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Receita</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {utmData.map((u) => (
                    <tr key={u.source} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-2 font-semibold">{u.source}</td>
                      <td className="py-3 px-2 text-right">{u.views}</td>
                      <td className="py-3 px-2 text-right">{u.orders}</td>
                      <td className="py-3 px-2 text-right font-semibold text-primary">
                        R$ {u.revenue.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {u.views > 0 ? ((u.orders / u.views) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              {loading ? 'Carregando...' : 'Nenhum dado de campanha registrado. Adicione parâmetros UTM nos links dos seus anúncios.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
