import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardKPIs {
  investment: number;
  orders: number;
  costPerOrder: number;
  revenue: number;
  avgTicket: number;
  roi: number;
  preparing: number;
  outForDelivery: number;
  completed: number;
  cancelled: number;
}

export interface WeeklySale {
  day: string;
  pedidos: number;
  receita: number;
}

export interface FunnelStep {
  step: string;
  label: string;
  sessions: number;
}

export interface TopCustomer {
  name: string;
  phone: string;
  orders: number;
  total: number;
}

export interface CampaignSale {
  campaign: string;
  source: string;
  orders: number;
  revenue: number;
  views: number;
}

export interface AdSale {
  adLink: string;
  source: string;
  campaign: string;
  orders: number;
  revenue: number;
  views: number;
}

export interface PageViewStats {
  page_type: string;
  count: number;
}

const FUNNEL_ORDER = ['menu_home', 'category', 'product', 'add_to_cart', 'cart', 'checkout'];
const FUNNEL_LABELS: Record<string, string> = {
  menu_home: 'Página Inicial',
  category: 'Categorias',
  product: 'Produtos',
  add_to_cart: 'Add ao Carrinho',
  cart: 'Carrinho',
  checkout: 'Checkout',
};

export function useDashboardData(tenantId: string | null | undefined, dateRange: { from: Date; to: Date }) {
  const [kpis, setKpis] = useState<DashboardKPIs>({
    investment: 0, orders: 0, costPerOrder: 0, revenue: 0,
    avgTicket: 0, roi: 0, preparing: 0, outForDelivery: 0,
    completed: 0, cancelled: 0,
  });
  const [weeklySales, setWeeklySales] = useState<WeeklySale[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [campaignSales, setCampaignSales] = useState<CampaignSale[]>([]);
  const [adSales, setAdSales] = useState<AdSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const fromISO = dateRange.from.toISOString();
    const toISO = dateRange.to.toISOString();

    const load = async () => {
      setLoading(true);

      // Parallel fetches
      const [ordersRes, pageViewsRes, adAccountsRes] = await Promise.all([
        supabase.from('orders')
          .select('id, total, status, created_at, customer_name, customer_phone, utm_source, utm_campaign, utm_ad_link')
          .eq('tenant_id', tenantId)
          .gte('created_at', fromISO)
          .lte('created_at', toISO),
        supabase.from('menu_page_views' as any)
          .select('page_type, session_id, utm_source, utm_campaign, utm_ad_link')
          .eq('tenant_id', tenantId)
          .gte('created_at', fromISO)
          .lte('created_at', toISO),
        supabase.from('ad_accounts')
          .select('platform, last_synced_at')
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
      ]);

      const orders = ordersRes.data || [];
      const pageViews = (pageViewsRes.data as any[]) || [];

      // --- KPIs ---
      const validOrders = orders.filter(o => o.status !== 'cancelled');
      const revenue = validOrders.reduce((s, o) => s + Number(o.total), 0);
      const preparing = orders.filter(o => o.status === 'preparing').length;
      const outForDelivery = orders.filter(o => o.status === 'out_for_delivery').length;
      const completed = orders.filter(o => o.status === 'completed').length;
      const cancelled = orders.filter(o => o.status === 'cancelled').length;
      const avgTicket = validOrders.length > 0 ? revenue / validOrders.length : 0;

      // Investment: try fetching from edge function, fallback to 0
      let investment = 0;
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.access_token && (adAccountsRes.data?.length || 0) > 0) {
          const res = await supabase.functions.invoke('fetch-ad-campaigns', {
            headers: { Authorization: `Bearer ${session.session.access_token}` },
          });
          if (res.data?.summary?.total_spend) {
            investment = res.data.summary.total_spend;
          }
        }
      } catch { /* ignore */ }

      const costPerOrder = validOrders.length > 0 ? investment / validOrders.length : 0;
      const roi = investment > 0 ? ((revenue - investment) / investment) * 100 : 0;

      setKpis({
        investment, orders: orders.length, costPerOrder, revenue,
        avgTicket, roi, preparing, outForDelivery, completed, cancelled,
      });

      // --- Funnel (unique sessions) ---
      const sessionsByStep = new Map<string, Set<string>>();
      pageViews.forEach((pv: any) => {
        const step = pv.page_type;
        if (!sessionsByStep.has(step)) sessionsByStep.set(step, new Set());
        sessionsByStep.get(step)!.add(pv.session_id);
      });
      const funnelData = FUNNEL_ORDER
        .filter(step => sessionsByStep.has(step))
        .map(step => ({
          step,
          label: FUNNEL_LABELS[step] || step,
          sessions: sessionsByStep.get(step)!.size,
        }));
      setFunnel(funnelData);

      // --- Top Customers ---
      const customerMap = new Map<string, TopCustomer>();
      validOrders.forEach(o => {
        const key = o.customer_phone;
        const existing = customerMap.get(key) || { name: o.customer_name, phone: o.customer_phone, orders: 0, total: 0 };
        existing.orders++;
        existing.total += Number(o.total);
        existing.name = o.customer_name; // keep latest name
        customerMap.set(key, existing);
      });
      setTopCustomers(
        Array.from(customerMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)
      );

      // --- Campaign Sales ---
      const campaignMap = new Map<string, CampaignSale>();
      validOrders.filter(o => o.utm_campaign).forEach(o => {
        const key = `${o.utm_source || 'direct'}::${o.utm_campaign}`;
        const existing = campaignMap.get(key) || { campaign: o.utm_campaign!, source: o.utm_source || 'direct', orders: 0, revenue: 0, views: 0 };
        existing.orders++;
        existing.revenue += Number(o.total);
        campaignMap.set(key, existing);
      });
      // Enrich with views
      pageViews.filter((pv: any) => pv.utm_campaign).forEach((pv: any) => {
        const key = `${pv.utm_source || 'direct'}::${pv.utm_campaign}`;
        const existing = campaignMap.get(key);
        if (existing) existing.views++;
        else campaignMap.set(key, { campaign: pv.utm_campaign, source: pv.utm_source || 'direct', orders: 0, revenue: 0, views: 1 });
      });
      setCampaignSales(Array.from(campaignMap.values()).sort((a, b) => b.revenue - a.revenue));

      // --- Ad Sales (utm_ad_link) ---
      const adMap = new Map<string, AdSale>();
      validOrders.filter(o => o.utm_ad_link).forEach(o => {
        const key = o.utm_ad_link!;
        const existing = adMap.get(key) || { adLink: key, source: o.utm_source || '', campaign: o.utm_campaign || '', orders: 0, revenue: 0, views: 0 };
        existing.orders++;
        existing.revenue += Number(o.total);
        adMap.set(key, existing);
      });
      pageViews.filter((pv: any) => pv.utm_ad_link).forEach((pv: any) => {
        const key = pv.utm_ad_link;
        const existing = adMap.get(key);
        if (existing) existing.views++;
        else adMap.set(key, { adLink: key, source: pv.utm_source || '', campaign: pv.utm_campaign || '', orders: 0, revenue: 0, views: 1 });
      });
      setAdSales(Array.from(adMap.values()).sort((a, b) => b.revenue - a.revenue));

      // --- Weekly Sales ---
      const weekData: WeeklySale[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);

        const dayOrders = orders.filter(o => {
          const created = new Date(o.created_at);
          return created >= dayStart && created <= dayEnd;
        });
        const dayValid = dayOrders.filter(o => o.status !== 'cancelled');
        weekData.push({
          day: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
          pedidos: dayOrders.length,
          receita: dayValid.reduce((s, o) => s + Number(o.total), 0),
        });
      }
      setWeeklySales(weekData);
      setLoading(false);
    };

    load();
  }, [tenantId, dateRange.from.getTime(), dateRange.to.getTime()]);

  return { kpis, weeklySales, funnel, topCustomers, campaignSales, adSales, loading };
}
