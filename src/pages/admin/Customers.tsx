import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Crown, Phone, Mail, MapPin, ShoppingBag,
  DollarSign, Calendar, TrendingUp, Star, Save, Tag, ArrowUpDown,
  ChevronUp, ChevronDown, Award, Gift, Globe, ExternalLink, CreditCard,
  Truck, Clock, RotateCcw, AlertTriangle, MessageSquare, Ticket,
  Send, Brain, Loader2, Plus, Trash2, Sparkles, X
} from 'lucide-react';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';
import { toast } from 'sonner';
import { paymentMethodLabels, paymentStatusLabels, statusConfig } from '@/components/admin/orders/types';

// ── Types ──
interface Customer {
  id: string; name: string; phone: string; email: string | null;
  address: string | null; neighborhood: string | null; city: string | null;
  notes: string | null; tags: string[]; total_orders: number; total_spent: number;
  avg_ticket: number; last_order_at: string | null; first_order_at: string | null;
  loyalty_points: number; loyalty_tier: string; created_at: string;
  birthday: string | null;
}

interface OrderHistory {
  id: string; order_number: number; total: number; subtotal: number;
  delivery_fee: number; discount: number; status: string; payment_method: string;
  payment_status: string; created_at: string; delivery_address: string | null;
  delivery_neighborhood: string | null; delivery_city: string | null;
  delivery_notes: string | null; notes: string | null;
  utm_source: string | null; utm_campaign: string | null; utm_medium: string | null;
  utm_content: string | null; utm_term: string | null; utm_ad_link: string | null;
  session_id: string | null; stripe_payment_intent_id: string | null;
}

interface WaTemplate { id: string; name: string; message: string; category: string; is_active: boolean; }
interface Coupon { id: string; code: string; description: string | null; discount_type: string; discount_value: number; is_active: boolean; expires_at: string | null; used_count: number; max_uses: number | null; }

const tierConfig: Record<string, { label: string; color: string; icon: string }> = {
  bronze: { label: 'Bronze', color: 'text-amber-600', icon: '🥉' },
  silver: { label: 'Prata', color: 'text-gray-400', icon: '🥈' },
  gold: { label: 'Ouro', color: 'text-yellow-400', icon: '🥇' },
  platinum: { label: 'Platina', color: 'text-cyan-400', icon: '💎' },
};

type SortField = 'total_spent' | 'total_orders' | 'last_order_at' | 'name' | 'loyalty_points';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

function calcAvgReturnDays(orders: { created_at: string; status: string }[]): number | null {
  const completed = orders.filter(o => o.status !== 'cancelled').map(o => new Date(o.created_at).getTime()).sort((a, b) => a - b);
  if (completed.length < 2) return null;
  let totalDiff = 0;
  for (let i = 1; i < completed.length; i++) totalDiff += completed[i] - completed[i - 1];
  return totalDiff / (completed.length - 1) / (1000 * 60 * 60 * 24);
}

const formatReturnDays = (days: number | null) => {
  if (days === null) return '—';
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  return `${Math.round(days / 30)}m`;
};

// ── Component ──
const Customers = () => {
  const { tenantId } = useAuth();
  const { preset, setPreset, dateRange, customRange, setCustomRange } = useDateRange('max');

  // Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_spent');
  const [sortAsc, setSortAsc] = useState(false);
  const [allOrdersDates, setAllOrdersDates] = useState<{ customer_phone: string; created_at: string; status: string }[]>([]);

  // Detail
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Loyalty transactions for dossier
  const [loyaltyTxns, setLoyaltyTxns] = useState<{ id: string; type: string; points: number; description: string | null; created_at: string }[]>([]);
  const [customerCouponUsage, setCustomerCouponUsage] = useState<{ id: string; discount_applied: number; order_total: number; used_at: string; coupon_id: string }[]>([]);

  // Inactive filter
  const [inactivityDays, setInactivityDays] = useState(29);
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [filterDaysWithout, setFilterDaysWithout] = useState<number | null>(null);

  // Reactivation dialog
  const [reactivationOpen, setReactivationOpen] = useState(false);
  const [selectedInactiveCustomers, setSelectedInactiveCustomers] = useState<Customer[]>([]);

  // Templates & Coupons
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedCoupon, setSelectedCoupon] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateMsg, setNewTemplateMsg] = useState('');
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<'percentage' | 'fixed'>('percentage');
  const [newCouponValue, setNewCouponValue] = useState('');
  const [newCouponExpiry, setNewCouponExpiry] = useState('');
  const [showNewCoupon, setShowNewCoupon] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);

  // WhatsApp instance
  const [waInstance, setWaInstance] = useState<any>(null);

  // ── Fetchers ──
  const fetchCustomers = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    let query = supabase.from('customers').select('*').eq('tenant_id', tenantId);
    if (preset !== 'max') {
      query = query.gte('last_order_at', dateRange.from.toISOString()).lte('last_order_at', dateRange.to.toISOString());
    }
    const { data } = await query.order('total_spent', { ascending: false });
    setCustomers((data as Customer[]) || []);
    setLoading(false);
  }, [tenantId, preset, dateRange.from, dateRange.to]);

  const fetchAllOrdersDates = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('orders').select('customer_phone, created_at, status')
      .eq('tenant_id', tenantId).neq('status', 'cancelled').order('created_at', { ascending: true });
    setAllOrdersDates(data || []);
  }, [tenantId]);

  const fetchTemplates = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('whatsapp_templates').select('*').eq('tenant_id', tenantId).eq('is_active', true);
    setTemplates((data as WaTemplate[]) || []);
  }, [tenantId]);

  const fetchCoupons = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('coupons').select('*').eq('tenant_id', tenantId).eq('is_active', true);
    setCoupons((data as Coupon[]) || []);
  }, [tenantId]);

  const fetchWaInstance = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('whatsapp_instances').select('*').eq('tenant_id', tenantId).single();
    setWaInstance(data);
  }, [tenantId]);

  useEffect(() => {
    fetchCustomers();
    fetchAllOrdersDates();
    fetchTemplates();
    fetchCoupons();
    fetchWaInstance();
  }, [fetchCustomers, fetchAllOrdersDates, fetchTemplates, fetchCoupons, fetchWaInstance]);

  // ── Detail open ──
  const openDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditNotes(customer.notes || '');
    setEditEmail(customer.email || '');
    setEditTags((customer.tags || []).join(', '));
    setEditBirthday(customer.birthday || '');
    setDetailOpen(true);
    setExpandedOrder(null);
    setAiAnalysis(null);
    setLoyaltyTxns([]);
    setCustomerCouponUsage([]);

    // Fetch orders, loyalty transactions, coupon usage in parallel
    const [ordersRes, loyaltyRes, couponUsageRes] = await Promise.all([
      supabase.from('orders')
        .select('id, order_number, total, subtotal, delivery_fee, discount, status, payment_method, payment_status, created_at, delivery_address, delivery_neighborhood, delivery_city, delivery_notes, notes, utm_source, utm_campaign, utm_medium, utm_content, utm_term, utm_ad_link, session_id, stripe_payment_intent_id')
        .eq('tenant_id', tenantId!).eq('customer_phone', customer.phone)
        .order('created_at', { ascending: false }),
      supabase.from('loyalty_transactions')
        .select('id, type, points, description, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('coupon_usage')
        .select('id, discount_applied, order_total, used_at, coupon_id')
        .eq('customer_phone', customer.phone)
        .eq('tenant_id', tenantId!)
        .order('used_at', { ascending: false })
        .limit(20),
    ]);
    setOrderHistory((ordersRes.data as OrderHistory[]) || []);
    setLoyaltyTxns((loyaltyRes.data as any[]) || []);
    setCustomerCouponUsage((couponUsageRes.data as any[]) || []);
  };

  // ── AI analysis ──
  const runAiAnalysis = async () => {
    if (!selectedCustomer || !tenantId) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-customer', {
        body: { customer_phone: selectedCustomer.phone, tenant_id: tenantId },
      });
      console.log('AI analysis response:', { data, error });
      if (error) {
        // supabase.functions.invoke wraps non-2xx as FunctionsHttpError
        const errorBody = typeof error === 'object' && 'context' in error ? await (error as any).context?.json?.() : null;
        toast.error(errorBody?.error || 'Erro ao analisar cliente');
        setAiLoading(false);
        return;
      }
      if (data?.error) { toast.error(data.error); setAiLoading(false); return; }
      setAiAnalysis(data?.analysis || 'Sem dados para análise.');
    } catch (e: any) {
      toast.error('Erro ao analisar cliente: ' + (e?.message || 'erro desconhecido'));
      console.error('AI analysis error:', e);
    }
    setAiLoading(false);
  };

  // ── Save customer ──
  const saveCustomer = async () => {
    if (!selectedCustomer) return;
    setSaving(true);
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
    await supabase.from('customers').update({
      notes: editNotes, email: editEmail || null, tags,
      birthday: editBirthday || null,
    }).eq('id', selectedCustomer.id);
    toast.success('Cliente atualizado');
    setSaving(false);
    fetchCustomers();
  };

  // ── Sorting ──
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  // ── Inactive customers ──
  const inactiveCustomers = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - inactivityDays);
    return customers.filter(c => {
      if (!c.last_order_at) return true;
      return new Date(c.last_order_at) < cutoff;
    });
  }, [customers, inactivityDays]);

  // Helper: days since last order
  const getDaysSinceLastOrder = (customer: Customer): number | null => {
    if (!customer.last_order_at) return null;
    return Math.floor((Date.now() - new Date(customer.last_order_at).getTime()) / (1000 * 60 * 60 * 24));
  };

  // ── Filtered list ──
  const filtered = useMemo(() => {
    let list = showInactiveOnly ? [...inactiveCustomers] : [...customers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email || '').toLowerCase().includes(q));
    }
    if (filterDaysWithout !== null) {
      list = list.filter(c => {
        const days = getDaysSinceLastOrder(c);
        return days === null || days >= filterDaysWithout;
      });
    }
    list.sort((a, b) => {
      let va: any = a[sortField]; let vb: any = b[sortField];
      if (sortField === 'name') { va = va?.toLowerCase(); vb = vb?.toLowerCase(); }
      if (sortField === 'last_order_at') { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0; }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [customers, inactiveCustomers, showInactiveOnly, search, sortField, sortAsc, filterDaysWithout]);

  // ── KPIs ──
  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((s, c) => s + c.total_spent, 0);
  const avgLTV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const returning = customers.filter(c => c.total_orders > 1).length;
  const returnRate = totalCustomers > 0 ? (returning / totalCustomers) * 100 : 0;

  const globalAvgReturnDays = useMemo(() => {
    if (allOrdersDates.length === 0) return null;
    const byPhone: Record<string, number[]> = {};
    allOrdersDates.forEach(o => {
      if (!byPhone[o.customer_phone]) byPhone[o.customer_phone] = [];
      byPhone[o.customer_phone].push(new Date(o.created_at).getTime());
    });
    let totalDiff = 0, totalGaps = 0;
    Object.values(byPhone).forEach(dates => {
      if (dates.length < 2) return;
      dates.sort((a, b) => a - b);
      for (let i = 1; i < dates.length; i++) { totalDiff += dates[i] - dates[i - 1]; totalGaps++; }
    });
    return totalGaps === 0 ? null : totalDiff / totalGaps / (1000 * 60 * 60 * 24);
  }, [allOrdersDates]);

  const customerAvgReturn = useMemo(() => calcAvgReturnDays(orderHistory), [orderHistory]);

  // ── Template / Coupon creation ──
  const createTemplate = async () => {
    if (!newTemplateName || !newTemplateMsg || !tenantId) return;
    await supabase.from('whatsapp_templates').insert({ tenant_id: tenantId, name: newTemplateName, message: newTemplateMsg, category: 'reactivation' });
    toast.success('Template criado');
    setNewTemplateName(''); setNewTemplateMsg(''); setShowNewTemplate(false);
    fetchTemplates();
  };

  const createCoupon = async () => {
    if (!newCouponCode || !newCouponValue || !tenantId) return;
    await supabase.from('coupons').insert({
      tenant_id: tenantId, code: newCouponCode.toUpperCase(), discount_type: newCouponType,
      discount_value: parseFloat(newCouponValue),
      expires_at: newCouponExpiry ? new Date(newCouponExpiry).toISOString() : null,
    });
    toast.success('Cupom criado');
    setNewCouponCode(''); setNewCouponValue(''); setNewCouponExpiry(''); setShowNewCoupon(false);
    fetchCoupons();
  };

  // ── Send WhatsApp ──
  const sendWhatsAppBulk = async () => {
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template || !waInstance?.instance_name || !waInstance?.instance_token) {
      toast.error('Selecione um template e verifique a conexão do WhatsApp');
      return;
    }
    setSendingWa(true);
    const coupon = coupons.find(c => c.id === selectedCoupon);
    let sent = 0;
    for (const customer of selectedInactiveCustomers) {
      let msg = template.message
        .replace('{{nome}}', customer.name.split(' ')[0])
        .replace('{{cupom}}', coupon?.code || '')
        .replace('{{desconto}}', coupon ? `${coupon.discount_value}${coupon.discount_type === 'percentage' ? '%' : ' reais'}` : '');
      
      const phone = customer.phone.replace(/\D/g, '');
      try {
        await fetch(`https://api.uazapi.com/v2/sendText/${waInstance.instance_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': waInstance.instance_token },
          body: JSON.stringify({ to: `${phone}@s.whatsapp.net`, text: msg }),
        });
        sent++;
      } catch { /* skip failed */ }
    }
    toast.success(`${sent} mensagens enviadas com sucesso!`);
    setSendingWa(false);
    setReactivationOpen(false);
  };

  const medals = ['🥇', '🥈', '🥉'];
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    return sortAsc ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalCustomers} clientes cadastrados
            {showInactiveOnly && <span className="text-orange-400 ml-2">· Filtro: inativos há {inactivityDays}+ dias</span>}
          </p>
        </motion.div>
        <DateRangeFilter preset={preset} onPresetChange={setPreset} customRange={customRange} onCustomRangeChange={setCustomRange} />
      </div>

      {/* KPI Cards */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total de Clientes', value: totalCustomers.toString(), icon: Users, gradient: 'from-blue-500/20 to-cyan-600/10', iconColor: 'text-blue-400', border: 'border-blue-500/20' },
          { label: 'Receita Total', value: `R$ ${totalRevenue.toFixed(0)}`, icon: DollarSign, gradient: 'from-emerald-500/20 to-green-600/10', iconColor: 'text-emerald-400', border: 'border-emerald-500/20' },
          { label: 'LTV Médio', value: `R$ ${avgLTV.toFixed(2).replace('.', ',')}`, icon: TrendingUp, gradient: 'from-primary/20 to-accent/10', iconColor: 'text-primary', border: 'border-primary/20' },
          { label: 'Taxa de Retorno', value: `${returnRate.toFixed(1)}%`, icon: Award, gradient: 'from-purple-500/20 to-violet-600/10', iconColor: 'text-purple-400', border: 'border-purple-500/20' },
          { label: 'Tempo Médio Retorno', value: formatReturnDays(globalAvgReturnDays), icon: RotateCcw, gradient: 'from-orange-500/20 to-amber-600/10', iconColor: 'text-orange-400', border: 'border-orange-500/20' },
        ].map(kpi => (
          <motion.div key={kpi.label} variants={item}>
            <div className={`relative overflow-hidden rounded-xl border ${kpi.border} bg-gradient-to-br ${kpi.gradient} backdrop-blur-sm p-4 cursor-default`}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`h-4 w-4 ${kpi.iconColor} opacity-70`} />
              </div>
              <div className="text-xl font-display font-bold text-foreground">{kpi.value}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Inactive Alert Card */}
      {inactiveCustomers.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <div
            className="relative overflow-hidden rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-red-500/5 to-amber-500/10 p-4 cursor-pointer hover:border-orange-500/50 transition-all group"
            onClick={() => {
              setShowInactiveOnly(!showInactiveOnly);
              if (!showInactiveOnly) {
                setSelectedInactiveCustomers(inactiveCustomers);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="font-display font-bold text-lg text-foreground">
                    {inactiveCustomers.length} cliente{inactiveCustomers.length !== 1 ? 's' : ''} inativo{inactiveCustomers.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">Sem pedidos há {inactivityDays}+ dias · Clique para {showInactiveOnly ? 'remover filtro' : 'filtrar'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={inactivityDays.toString()} onValueChange={v => { setInactivityDays(parseInt(v)); setShowInactiveOnly(false); }}>
                  <SelectTrigger className="w-[90px] h-8 text-xs bg-muted/20 border-border/30" onClick={e => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 29, 45, 60, 90].map(d => (
                      <SelectItem key={d} value={d.toString()}>{d} dias</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="gradient-primary text-xs gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInactiveCustomers(inactiveCustomers);
                    setReactivationOpen(true);
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Reativar
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Search + Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, telefone ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-muted/20 border-border/20" />
        </div>
        <Select value={filterDaysWithout?.toString() || 'all'} onValueChange={v => setFilterDaysWithout(v === 'all' ? null : parseInt(v))}>
          <SelectTrigger className="w-[180px] bg-muted/20 border-border/20 text-sm">
            <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Dias sem pedir" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            <SelectItem value="10">+10 dias sem pedir</SelectItem>
            <SelectItem value="30">+30 dias sem pedir</SelectItem>
            <SelectItem value="45">+45 dias sem pedir</SelectItem>
            <SelectItem value="60">+60 dias sem pedir</SelectItem>
            <SelectItem value="90">+90 dias sem pedir</SelectItem>
            <SelectItem value="180">+180 dias sem pedir</SelectItem>
          </SelectContent>
        </Select>
        {(showInactiveOnly || filterDaysWithout !== null) && (
          <Button variant="outline" size="sm" className="border-orange-500/30 text-orange-400" onClick={() => { setShowInactiveOnly(false); setFilterDaysWithout(null); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>

      {/* Customer Table */}
      <Card className="glass border-border/30">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider w-10">#</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-foreground transition-colors">Cliente <SortIcon field="name" /></button>
                    </th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden md:table-cell">Tier</th>
                    <th className="text-center py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      <button onClick={() => handleSort('total_orders')} className="flex items-center gap-1 hover:text-foreground transition-colors mx-auto">Pedidos <SortIcon field="total_orders" /></button>
                    </th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      <button onClick={() => handleSort('total_spent')} className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto">Total Gasto <SortIcon field="total_spent" /></button>
                    </th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Ticket Médio</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden sm:table-cell">
                      <button onClick={() => handleSort('last_order_at')} className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto">Último Pedido <SortIcon field="last_order_at" /></button>
                    </th>
                    <th className="text-center py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Dias s/ Pedir</th>
                    <th className="text-center py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden lg:table-cell">
                      <button onClick={() => handleSort('loyalty_points')} className="flex items-center gap-1 hover:text-foreground transition-colors mx-auto">Pontos <SortIcon field="loyalty_points" /></button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((customer, i) => {
                    const tier = tierConfig[customer.loyalty_tier] || tierConfig.bronze;
                    return (
                      <tr key={customer.id} className="border-b border-border/10 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => openDetail(customer)}>
                        <td className="py-3 px-3"><span className="text-sm">{i < 3 ? medals[i] : <span className="text-xs text-muted-foreground font-bold">{i + 1}º</span>}</span></td>
                        <td className="py-3 px-3">
                          <div>
                            <p className="font-semibold text-sm truncate max-w-[180px]">{customer.name}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3 hidden md:table-cell"><span className={`text-xs font-medium ${tier.color}`}>{tier.icon} {tier.label}</span></td>
                        <td className="py-3 px-3 text-center"><span className="font-semibold">{customer.total_orders}</span></td>
                        <td className="py-3 px-3 text-right"><span className="font-bold text-emerald-400">R$ {Number(customer.total_spent).toFixed(2).replace('.', ',')}</span></td>
                        <td className="py-3 px-3 text-right hidden lg:table-cell"><span className="text-sm">R$ {Number(customer.avg_ticket).toFixed(2).replace('.', ',')}</span></td>
                        <td className="py-3 px-3 text-right hidden sm:table-cell"><span className="text-xs text-muted-foreground">{customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString('pt-BR') : '—'}</span></td>
                        <td className="py-3 px-3 text-center hidden sm:table-cell">
                          {(() => {
                            const days = getDaysSinceLastOrder(customer);
                            if (days === null) return <span className="text-xs text-muted-foreground">—</span>;
                            const color = days >= 60 ? 'text-red-400' : days >= 30 ? 'text-orange-400' : days >= 10 ? 'text-amber-400' : 'text-emerald-400';
                            return <span className={`text-xs font-semibold ${color}`}>{days}d</span>;
                          })()}
                        </td>
                        <td className="py-3 px-3 text-center hidden lg:table-cell"><Badge variant="outline" className="text-[10px] px-1.5"><Star className="h-3 w-3 mr-0.5 text-amber-400" />{customer.loyalty_points}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Customer Detail Sheet ── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-card border-border/30">
          {selectedCustomer && (() => {
            const tier = tierConfig[selectedCustomer.loyalty_tier] || tierConfig.bronze;
            return (
              <>
                <SheetHeader className="pb-4">
                  <SheetTitle className="font-display text-xl flex items-center gap-2"><Crown className="h-5 w-5 text-amber-400" /> Dossiê do Cliente</SheetTitle>
                </SheetHeader>
                <div className="space-y-5 mt-2">
                  {/* Avatar */}
                  <div className="text-center p-5 rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/10">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-primary">{selectedCustomer.name[0]?.toUpperCase()}</span>
                    </div>
                    <h3 className="font-display font-bold text-lg">{selectedCustomer.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-1"><Phone className="h-3.5 w-3.5" /> {selectedCustomer.phone}</p>
                    {selectedCustomer.email && <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-0.5"><Mail className="h-3.5 w-3.5" /> {selectedCustomer.email}</p>}
                    <div className="mt-3"><Badge className={`${tier.color} border border-current/20 bg-current/5`}>{tier.icon} {tier.label} · {selectedCustomer.loyalty_points} pontos</Badge></div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: ShoppingBag, color: 'text-blue-400', value: selectedCustomer.total_orders.toString(), label: 'Pedidos' },
                      { icon: DollarSign, color: 'text-emerald-400', value: `R$ ${Number(selectedCustomer.total_spent).toFixed(0)}`, label: 'Total Gasto' },
                      { icon: TrendingUp, color: 'text-primary', value: `R$ ${Number(selectedCustomer.avg_ticket).toFixed(2).replace('.', ',')}`, label: 'Ticket Médio' },
                      { icon: Calendar, color: 'text-purple-400', value: selectedCustomer.first_order_at ? new Date(selectedCustomer.first_order_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) : '—', label: 'Cliente desde' },
                      { icon: Clock, color: 'text-amber-400', value: selectedCustomer.last_order_at ? new Date(selectedCustomer.last_order_at).toLocaleDateString('pt-BR') : '—', label: 'Último Pedido' },
                      { icon: RotateCcw, color: 'text-orange-400', value: formatReturnDays(customerAvgReturn), label: 'Retorno Médio' },
                    ].map(s => (
                      <div key={s.label} className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
                        <s.icon className={`h-4 w-4 ${s.color} mx-auto mb-1`} />
                        <p className="font-display font-bold text-sm">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* AI Analysis */}
                  <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-600/5 border border-violet-500/15">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 text-violet-400" /> Análise de IA
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-violet-400 hover:text-violet-300" onClick={runAiAnalysis} disabled={aiLoading}>
                        {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                        {aiAnalysis ? 'Reanalisar' : 'Analisar Preferências'}
                      </Button>
                    </div>
                    {aiAnalysis ? (
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiAnalysis}</div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Clique em "Analisar Preferências" para gerar insights baseados no histórico de compras.</p>
                    )}
                  </div>

                  {/* Address */}
                  {selectedCustomer.address && (
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2"><MapPin className="h-3.5 w-3.5" /> Endereço</span>
                      <p className="text-sm">{selectedCustomer.address}</p>
                      {selectedCustomer.neighborhood && <p className="text-sm text-muted-foreground">{selectedCustomer.neighborhood}{selectedCustomer.city ? ` - ${selectedCustomer.city}` : ''}</p>}
                    </div>
                  )}

                  <Separator className="bg-border/20" />

                  {/* Editable Fields */}
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Informações Adicionais</span>
                    <div>
                      <Label className="text-xs text-muted-foreground">E-mail</Label>
                      <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@exemplo.com" className="mt-1 bg-muted/20 border-border/20" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Cake className="h-3 w-3" /> Data de Aniversário</Label>
                      <Input type="date" value={editBirthday} onChange={(e) => setEditBirthday(e.target.value)} className="mt-1 bg-muted/20 border-border/20" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</Label>
                      <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="vip, frequente" className="mt-1 bg-muted/20 border-border/20" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Observações</Label>
                      <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Anotações..." className="mt-1 bg-muted/20 border-border/20 min-h-[60px]" />
                    </div>
                    <Button className="w-full gradient-primary" onClick={saveCustomer} disabled={saving}><Save className="h-4 w-4 mr-2" /> Salvar</Button>
                  </div>

                  <Separator className="bg-border/20" />

                  {/* Loyalty Section Enhanced */}
                  <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-600/5 border border-amber-500/15">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2"><Gift className="h-3.5 w-3.5 text-amber-400" /> Fidelidade</span>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{tier.icon} {tier.label}</p>
                        <p className="text-xs text-muted-foreground">{selectedCustomer.loyalty_points} pontos</p>
                      </div>
                      <p className="text-xs font-semibold text-amber-400">
                        {selectedCustomer.loyalty_tier === 'bronze' ? 'Prata (500)' : selectedCustomer.loyalty_tier === 'silver' ? 'Ouro (1500)' : selectedCustomer.loyalty_tier === 'gold' ? 'Platina (5000)' : 'Máximo 🏆'}
                      </p>
                    </div>

                    {/* Loyalty transactions */}
                    {loyaltyTxns.length > 0 && (
                      <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Histórico de Pontos</p>
                        {loyaltyTxns.map(tx => (
                          <div key={tx.id} className="flex justify-between items-center text-xs py-1 border-b border-border/10 last:border-0">
                            <div>
                              <span className={tx.type === 'earn' ? 'text-emerald-400' : 'text-destructive'}>
                                {tx.type === 'earn' ? '+' : ''}{tx.points} pts
                              </span>
                              {tx.description && <span className="text-muted-foreground ml-1.5">{tx.description}</span>}
                            </div>
                            <span className="text-muted-foreground text-[10px]">{new Date(tx.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Coupon usage history */}
                  {customerCouponUsage.length > 0 && (
                    <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/10">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2"><Ticket className="h-3.5 w-3.5 text-primary" /> Cupons Utilizados</span>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {customerCouponUsage.map(cu => (
                          <div key={cu.id} className="flex justify-between items-center text-xs py-1 border-b border-border/10 last:border-0">
                            <div>
                              <span className="text-destructive">-R$ {Number(cu.discount_applied).toFixed(2).replace('.', ',')}</span>
                              <span className="text-muted-foreground ml-1.5">em pedido de R$ {Number(cu.order_total).toFixed(2).replace('.', ',')}</span>
                            </div>
                            <span className="text-muted-foreground text-[10px]">{new Date(cu.used_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator className="bg-border/20" />

                  {/* Full Order History */}
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">Histórico Completo ({orderHistory.length})</span>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {orderHistory.map(h => {
                        const isExpanded = expandedOrder === h.id;
                        const sConfig = statusConfig[h.status as keyof typeof statusConfig];
                        const hasTracking = h.utm_source || h.utm_campaign || h.utm_medium || h.utm_content || h.utm_term || h.utm_ad_link;
                        return (
                          <div key={h.id} className={`rounded-lg border transition-colors ${isExpanded ? 'bg-muted/20 border-primary/20' : 'bg-muted/10 border-border/10 hover:bg-muted/20'}`}>
                            <div className="flex items-center justify-between py-2.5 px-3 cursor-pointer" onClick={() => setExpandedOrder(isExpanded ? null : h.id)}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-primary">#{h.order_number}</span>
                                  {sConfig && <Badge className={`${sConfig.bgClass} ${sConfig.color} border text-[10px] px-1.5 py-0`}>{sConfig.label}</Badge>}
                                </div>
                                <p className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleDateString('pt-BR')} às {new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <span className="text-sm font-bold">R$ {Number(h.total).toFixed(2).replace('.', ',')}</span>
                                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-2.5 border-t border-border/10 pt-2.5">
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div><span className="text-muted-foreground">Subtotal</span><p className="font-semibold">R$ {Number(h.subtotal).toFixed(2).replace('.', ',')}</p></div>
                                  <div><span className="text-muted-foreground">Entrega</span><p className="font-semibold">R$ {Number(h.delivery_fee).toFixed(2).replace('.', ',')}</p></div>
                                  {Number(h.discount) > 0 && <div><span className="text-muted-foreground">Desconto</span><p className="font-semibold text-emerald-400">-R$ {Number(h.discount).toFixed(2).replace('.', ',')}</p></div>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-3 w-3 text-muted-foreground" />
                                  <Badge variant="outline" className="text-[10px]">{paymentMethodLabels[h.payment_method as keyof typeof paymentMethodLabels] || h.payment_method}</Badge>
                                  <Badge className={`text-[10px] border ${h.payment_status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                    {paymentStatusLabels[h.payment_status as keyof typeof paymentStatusLabels] || h.payment_status}
                                  </Badge>
                                </div>
                                {h.delivery_address && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground flex items-center gap-1 mb-0.5"><Truck className="h-3 w-3" /> Endereço</span>
                                    <p>{h.delivery_address}</p>
                                    {h.delivery_neighborhood && <p className="text-muted-foreground">{h.delivery_neighborhood}{h.delivery_city ? ` - ${h.delivery_city}` : ''}</p>}
                                    {h.delivery_notes && <p className="text-muted-foreground mt-0.5">📝 {h.delivery_notes}</p>}
                                  </div>
                                )}
                                {h.notes && <div className="text-xs"><span className="text-muted-foreground">📝 Obs:</span> <span>{h.notes}</span></div>}
                                {hasTracking && (
                                  <div className="p-2 rounded-lg bg-muted/20 border border-border/10">
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5"><Globe className="h-3 w-3" /> Rastreamento</span>
                                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                                      {h.utm_source && <div><span className="text-muted-foreground">Fonte:</span> <span className="font-medium">{h.utm_source}</span></div>}
                                      {h.utm_campaign && <div><span className="text-muted-foreground">Campanha:</span> <span className="font-medium">{h.utm_campaign}</span></div>}
                                      {h.utm_medium && <div><span className="text-muted-foreground">Mídia:</span> <span className="font-medium">{h.utm_medium}</span></div>}
                                      {h.utm_content && <div><span className="text-muted-foreground">Conteúdo:</span> <span className="font-medium">{h.utm_content}</span></div>}
                                      {h.utm_term && <div><span className="text-muted-foreground">Termo:</span> <span className="font-medium">{h.utm_term}</span></div>}
                                      {h.utm_ad_link && <div><a href={h.utm_ad_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-accent flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Ver anúncio</a></div>}
                                    </div>
                                    {h.session_id && <p className="text-[10px] text-muted-foreground mt-1 font-mono">Sessão: {h.session_id.slice(0, 12)}...</p>}
                                  </div>
                                )}
                                {h.stripe_payment_intent_id && <p className="text-[10px] text-muted-foreground font-mono">Stripe: {h.stripe_payment_intent_id}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {orderHistory.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido encontrado</p>}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ── Reactivation Dialog ── */}
      <Dialog open={reactivationOpen} onOpenChange={setReactivationOpen}>
        <DialogContent className="sm:max-w-xl bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Campanha de Reativação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-orange-400">{selectedInactiveCustomers.length}</span> clientes inativos há {inactivityDays}+ dias serão impactados.
            </p>

            {/* Template Selection */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Template de Mensagem</Label>
              {templates.length > 0 ? (
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="bg-muted/20 border-border/30">
                    <SelectValue placeholder="Selecione um template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum template criado ainda.</p>
              )}
              {selectedTemplate && (
                <div className="mt-2 p-2 rounded-lg bg-muted/10 border border-border/10 text-xs">
                  <p className="text-muted-foreground mb-1">Preview:</p>
                  <p>{templates.find(t => t.id === selectedTemplate)?.message}</p>
                </div>
              )}
              <Button variant="ghost" size="sm" className="mt-2 text-xs text-primary" onClick={() => setShowNewTemplate(!showNewTemplate)}>
                <Plus className="h-3 w-3 mr-1" /> Novo template
              </Button>
              <AnimatePresence>
                {showNewTemplate && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="space-y-2 mt-2 p-3 rounded-lg bg-muted/10 border border-border/10">
                      <Input placeholder="Nome do template" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} className="bg-muted/20 border-border/20 text-sm" />
                      <Textarea
                        placeholder="Mensagem (use {{nome}}, {{cupom}}, {{desconto}})"
                        value={newTemplateMsg}
                        onChange={e => setNewTemplateMsg(e.target.value)}
                        className="bg-muted/20 border-border/20 text-sm min-h-[60px]"
                      />
                      <Button size="sm" className="gradient-primary text-xs" onClick={createTemplate}>Salvar Template</Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Separator className="bg-border/20" />

            {/* Coupon Selection */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5" /> Cupom de Desconto (opcional)
              </Label>
              {coupons.length > 0 && (
                <Select value={selectedCoupon} onValueChange={setSelectedCoupon}>
                  <SelectTrigger className="bg-muted/20 border-border/30">
                    <SelectValue placeholder="Anexar cupom..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cupom</SelectItem>
                    {coupons.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.discount_value}{c.discount_type === 'percentage' ? '%' : ' R$'} off
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="ghost" size="sm" className="mt-2 text-xs text-primary" onClick={() => setShowNewCoupon(!showNewCoupon)}>
                <Plus className="h-3 w-3 mr-1" /> Novo cupom
              </Button>
              <AnimatePresence>
                {showNewCoupon && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="space-y-2 mt-2 p-3 rounded-lg bg-muted/10 border border-border/10">
                      <div className="flex gap-2">
                        <Input placeholder="CÓDIGO" value={newCouponCode} onChange={e => setNewCouponCode(e.target.value)} className="bg-muted/20 border-border/20 text-sm uppercase flex-1" />
                        <Select value={newCouponType} onValueChange={v => setNewCouponType(v as any)}>
                          <SelectTrigger className="w-[100px] bg-muted/20 border-border/20 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">%</SelectItem>
                            <SelectItem value="fixed">R$</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Input type="number" placeholder="Valor" value={newCouponValue} onChange={e => setNewCouponValue(e.target.value)} className="bg-muted/20 border-border/20 text-sm flex-1" />
                        <Input type="date" placeholder="Expira em" value={newCouponExpiry} onChange={e => setNewCouponExpiry(e.target.value)} className="bg-muted/20 border-border/20 text-sm flex-1" />
                      </div>
                      <Button size="sm" className="gradient-primary text-xs" onClick={createCoupon}>Criar Cupom</Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Separator className="bg-border/20" />

            {/* Send */}
            <Button
              className="w-full gradient-primary"
              disabled={!selectedTemplate || sendingWa}
              onClick={sendWhatsAppBulk}
            >
              {sendingWa ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar para {selectedInactiveCustomers.length} clientes via WhatsApp
            </Button>

            {!waInstance?.instance_name && (
              <p className="text-xs text-red-400 text-center">⚠️ WhatsApp não configurado. Acesse a página de WhatsApp primeiro.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
