import { useState, useEffect, useMemo } from 'react';
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
import { motion } from 'framer-motion';
import {
  Users, Search, Crown, Phone, Mail, MapPin, ShoppingBag,
  DollarSign, Calendar, TrendingUp, Star, Save, Tag, ArrowUpDown,
  ChevronUp, ChevronDown, Award, Gift, Globe, ExternalLink, CreditCard,
  Truck, Clock, RotateCcw
} from 'lucide-react';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';
import { toast } from 'sonner';
import { paymentMethodLabels, paymentStatusLabels, statusConfig } from '@/components/admin/orders/types';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  notes: string | null;
  tags: string[];
  total_orders: number;
  total_spent: number;
  avg_ticket: number;
  last_order_at: string | null;
  first_order_at: string | null;
  loyalty_points: number;
  loyalty_tier: string;
  created_at: string;
}

interface OrderHistory {
  id: string;
  order_number: number;
  total: number;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  status: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  delivery_address: string | null;
  delivery_neighborhood: string | null;
  delivery_city: string | null;
  delivery_notes: string | null;
  notes: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_ad_link: string | null;
  session_id: string | null;
  stripe_payment_intent_id: string | null;
}

const tierConfig: Record<string, { label: string; color: string; icon: string }> = {
  bronze: { label: 'Bronze', color: 'text-amber-600', icon: '🥉' },
  silver: { label: 'Prata', color: 'text-gray-400', icon: '🥈' },
  gold: { label: 'Ouro', color: 'text-yellow-400', icon: '🥇' },
  platinum: { label: 'Platina', color: 'text-cyan-400', icon: '💎' },
};

type SortField = 'total_spent' | 'total_orders' | 'last_order_at' | 'name' | 'loyalty_points';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

function calcAvgReturnDays(orders: { created_at: string; status: string }[]): number | null {
  const completed = orders
    .filter(o => o.status !== 'cancelled')
    .map(o => new Date(o.created_at).getTime())
    .sort((a, b) => a - b);
  if (completed.length < 2) return null;
  let totalDiff = 0;
  for (let i = 1; i < completed.length; i++) {
    totalDiff += completed[i] - completed[i - 1];
  }
  return totalDiff / (completed.length - 1) / (1000 * 60 * 60 * 24);
}

const Customers = () => {
  const { tenantId } = useAuth();
  const { preset, setPreset, dateRange, customRange, setCustomRange } = useDateRange('max');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_spent');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTags, setEditTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  // For global avg return time KPI we fetch all orders dates
  const [allOrdersDates, setAllOrdersDates] = useState<{ customer_phone: string; created_at: string; status: string }[]>([]);

  const fetchCustomers = async () => {
    if (!tenantId) return;
    setLoading(true);

    let query = supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId);

    if (preset !== 'max') {
      query = query.gte('last_order_at', dateRange.from.toISOString())
        .lte('last_order_at', dateRange.to.toISOString());
    }

    const { data } = await query.order('total_spent', { ascending: false });
    setCustomers((data as Customer[]) || []);
    setLoading(false);
  };

  const fetchAllOrdersDates = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('orders')
      .select('customer_phone, created_at, status')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true });
    setAllOrdersDates(data || []);
  };

  useEffect(() => {
    fetchCustomers();
    fetchAllOrdersDates();
  }, [tenantId, dateRange.from.getTime(), dateRange.to.getTime()]);

  const openDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditNotes(customer.notes || '');
    setEditEmail(customer.email || '');
    setEditTags((customer.tags || []).join(', '));
    setDetailOpen(true);
    setExpandedOrder(null);

    const { data } = await supabase
      .from('orders')
      .select('id, order_number, total, subtotal, delivery_fee, discount, status, payment_method, payment_status, created_at, delivery_address, delivery_neighborhood, delivery_city, delivery_notes, notes, utm_source, utm_campaign, utm_medium, utm_content, utm_term, utm_ad_link, session_id, stripe_payment_intent_id')
      .eq('tenant_id', tenantId!)
      .eq('customer_phone', customer.phone)
      .order('created_at', { ascending: false });
    setOrderHistory((data as OrderHistory[]) || []);
  };

  const saveCustomer = async () => {
    if (!selectedCustomer) return;
    setSaving(true);
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
    await supabase
      .from('customers')
      .update({ notes: editNotes, email: editEmail || null, tags })
      .eq('id', selectedCustomer.id);
    toast.success('Cliente atualizado');
    setSaving(false);
    fetchCustomers();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const filtered = useMemo(() => {
    let list = [...customers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let va: any = a[sortField];
      let vb: any = b[sortField];
      if (sortField === 'name') { va = va?.toLowerCase(); vb = vb?.toLowerCase(); }
      if (sortField === 'last_order_at') { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0; }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [customers, search, sortField, sortAsc]);

  // KPIs
  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((s, c) => s + c.total_spent, 0);
  const avgLTV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const returning = customers.filter(c => c.total_orders > 1).length;
  const returnRate = totalCustomers > 0 ? (returning / totalCustomers) * 100 : 0;

  // Global avg return time
  const globalAvgReturnDays = useMemo(() => {
    if (allOrdersDates.length === 0) return null;
    // Group by phone
    const byPhone: Record<string, number[]> = {};
    allOrdersDates.forEach(o => {
      if (!byPhone[o.customer_phone]) byPhone[o.customer_phone] = [];
      byPhone[o.customer_phone].push(new Date(o.created_at).getTime());
    });
    let totalDiff = 0;
    let totalGaps = 0;
    Object.values(byPhone).forEach(dates => {
      if (dates.length < 2) return;
      dates.sort((a, b) => a - b);
      for (let i = 1; i < dates.length; i++) {
        totalDiff += dates[i] - dates[i - 1];
        totalGaps++;
      }
    });
    if (totalGaps === 0) return null;
    return totalDiff / totalGaps / (1000 * 60 * 60 * 24);
  }, [allOrdersDates]);

  // Customer-specific avg return
  const customerAvgReturn = useMemo(() => {
    return calcAvgReturnDays(orderHistory);
  }, [orderHistory]);

  const medals = ['🥇', '🥈', '🥉'];

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    return sortAsc ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
  };

  const formatReturnDays = (days: number | null) => {
    if (days === null) return '—';
    if (days < 1) return `${Math.round(days * 24)}h`;
    if (days < 30) return `${Math.round(days)}d`;
    return `${Math.round(days / 30)}m`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Clientes
          </h1>
          <p className="text-sm text-muted-foreground">{totalCustomers} clientes cadastrados</p>
        </motion.div>
        <DateRangeFilter
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
        />
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-muted/20 border-border/20"
        />
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
              <p className="text-sm text-muted-foreground">Clientes são adicionados automaticamente ao realizarem pedidos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider w-10">#</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Cliente <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden md:table-cell">Tier</th>
                    <th className="text-center py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      <button onClick={() => handleSort('total_orders')} className="flex items-center gap-1 hover:text-foreground transition-colors mx-auto">
                        Pedidos <SortIcon field="total_orders" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      <button onClick={() => handleSort('total_spent')} className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto">
                        Total Gasto <SortIcon field="total_spent" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Ticket Médio</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden sm:table-cell">
                      <button onClick={() => handleSort('last_order_at')} className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto">
                        Último Pedido <SortIcon field="last_order_at" />
                      </button>
                    </th>
                    <th className="text-center py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden lg:table-cell">
                      <button onClick={() => handleSort('loyalty_points')} className="flex items-center gap-1 hover:text-foreground transition-colors mx-auto">
                        Pontos <SortIcon field="loyalty_points" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((customer, i) => {
                    const tier = tierConfig[customer.loyalty_tier] || tierConfig.bronze;
                    return (
                      <tr
                        key={customer.id}
                        className="border-b border-border/10 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => openDetail(customer)}
                      >
                        <td className="py-3 px-3">
                          <span className="text-sm">{i < 3 ? medals[i] : <span className="text-xs text-muted-foreground font-bold">{i + 1}º</span>}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div>
                            <p className="font-semibold text-sm truncate max-w-[180px]">{customer.name}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-3 hidden md:table-cell">
                          <span className={`text-xs font-medium ${tier.color}`}>
                            {tier.icon} {tier.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-semibold">{customer.total_orders}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-bold text-emerald-400">
                            R$ {Number(customer.total_spent).toFixed(2).replace('.', ',')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right hidden lg:table-cell">
                          <span className="text-sm">R$ {Number(customer.avg_ticket).toFixed(2).replace('.', ',')}</span>
                        </td>
                        <td className="py-3 px-3 text-right hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {customer.last_order_at
                              ? new Date(customer.last_order_at).toLocaleDateString('pt-BR')
                              : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center hidden lg:table-cell">
                          <Badge variant="outline" className="text-[10px] px-1.5">
                            <Star className="h-3 w-3 mr-0.5 text-amber-400" />
                            {customer.loyalty_points}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-card border-border/30">
          {selectedCustomer && (() => {
            const tier = tierConfig[selectedCustomer.loyalty_tier] || tierConfig.bronze;
            return (
              <>
                <SheetHeader className="pb-4">
                  <SheetTitle className="font-display text-xl flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-400" />
                    Dossiê do Cliente
                  </SheetTitle>
                </SheetHeader>

                <div className="space-y-5 mt-2">
                  {/* Avatar & Name */}
                  <div className="text-center p-5 rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/10">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-primary">{selectedCustomer.name[0]?.toUpperCase()}</span>
                    </div>
                    <h3 className="font-display font-bold text-lg">{selectedCustomer.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                      <Phone className="h-3.5 w-3.5" /> {selectedCustomer.phone}
                    </p>
                    {selectedCustomer.email && (
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-0.5">
                        <Mail className="h-3.5 w-3.5" /> {selectedCustomer.email}
                      </p>
                    )}
                    <div className="mt-3">
                      <Badge className={`${tier.color} border border-current/20 bg-current/5`}>
                        {tier.icon} {tier.label} · {selectedCustomer.loyalty_points} pontos
                      </Badge>
                    </div>
                  </div>

                  {/* Stats - now 5 items with avg return */}
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

                  {/* Address */}
                  {selectedCustomer.address && (
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <MapPin className="h-3.5 w-3.5" /> Endereço
                      </span>
                      <p className="text-sm">{selectedCustomer.address}</p>
                      {selectedCustomer.neighborhood && (
                        <p className="text-sm text-muted-foreground">{selectedCustomer.neighborhood}{selectedCustomer.city ? ` - ${selectedCustomer.city}` : ''}</p>
                      )}
                    </div>
                  )}

                  <Separator className="bg-border/20" />

                  {/* Editable Fields */}
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Informações Adicionais</span>
                    <div>
                      <Label className="text-xs text-muted-foreground">E-mail</Label>
                      <Input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        className="mt-1 bg-muted/20 border-border/20"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Tag className="h-3 w-3" /> Tags (separadas por vírgula)
                      </Label>
                      <Input
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="vip, frequente, aniversariante"
                        className="mt-1 bg-muted/20 border-border/20"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Observações internas</Label>
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Anotações sobre este cliente..."
                        className="mt-1 bg-muted/20 border-border/20 min-h-[80px]"
                      />
                    </div>
                    <Button className="w-full gradient-primary" onClick={saveCustomer} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  </div>

                  <Separator className="bg-border/20" />

                  {/* Loyalty */}
                  <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-600/5 border border-amber-500/15">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Gift className="h-3.5 w-3.5 text-amber-400" /> Programa de Fidelidade
                    </span>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{tier.icon} {tier.label}</p>
                        <p className="text-xs text-muted-foreground">{selectedCustomer.loyalty_points} pontos acumulados</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Próximo nível</p>
                        <p className="text-xs font-semibold text-amber-400">
                          {selectedCustomer.loyalty_tier === 'bronze' ? 'Prata (500 pts)' :
                           selectedCustomer.loyalty_tier === 'silver' ? 'Ouro (1500 pts)' :
                           selectedCustomer.loyalty_tier === 'gold' ? 'Platina (5000 pts)' : 'Nível máximo 🏆'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border/20" />

                  {/* Full Order History */}
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
                      Histórico Completo de Pedidos ({orderHistory.length})
                    </span>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {orderHistory.map(h => {
                        const isExpanded = expandedOrder === h.id;
                        const sConfig = statusConfig[h.status as keyof typeof statusConfig];
                        const hasTracking = h.utm_source || h.utm_campaign || h.utm_medium || h.utm_content || h.utm_term || h.utm_ad_link;
                        
                        return (
                          <div
                            key={h.id}
                            className={`rounded-lg border transition-colors ${isExpanded ? 'bg-muted/20 border-primary/20' : 'bg-muted/10 border-border/10 hover:bg-muted/20'}`}
                          >
                            {/* Order Header - clickable */}
                            <div
                              className="flex items-center justify-between py-2.5 px-3 cursor-pointer"
                              onClick={() => setExpandedOrder(isExpanded ? null : h.id)}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-primary">#{h.order_number}</span>
                                  {sConfig && (
                                    <Badge className={`${sConfig.bgClass} ${sConfig.color} border text-[10px] px-1.5 py-0`}>
                                      {sConfig.label}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {new Date(h.created_at).toLocaleDateString('pt-BR')} às {new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <span className="text-sm font-bold">R$ {Number(h.total).toFixed(2).replace('.', ',')}</span>
                                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-2.5 border-t border-border/10 pt-2.5">
                                {/* Financial breakdown */}
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <p className="font-semibold">R$ {Number(h.subtotal).toFixed(2).replace('.', ',')}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Entrega</span>
                                    <p className="font-semibold">R$ {Number(h.delivery_fee).toFixed(2).replace('.', ',')}</p>
                                  </div>
                                  {Number(h.discount) > 0 && (
                                    <div>
                                      <span className="text-muted-foreground">Desconto</span>
                                      <p className="font-semibold text-emerald-400">-R$ {Number(h.discount).toFixed(2).replace('.', ',')}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Payment */}
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-3 w-3 text-muted-foreground" />
                                  <Badge variant="outline" className="text-[10px]">
                                    {paymentMethodLabels[h.payment_method as keyof typeof paymentMethodLabels] || h.payment_method}
                                  </Badge>
                                  <Badge className={`text-[10px] border ${h.payment_status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                    {paymentStatusLabels[h.payment_status as keyof typeof paymentStatusLabels] || h.payment_status}
                                  </Badge>
                                </div>

                                {/* Delivery address */}
                                {h.delivery_address && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground flex items-center gap-1 mb-0.5">
                                      <Truck className="h-3 w-3" /> Endereço
                                    </span>
                                    <p>{h.delivery_address}</p>
                                    {h.delivery_neighborhood && <p className="text-muted-foreground">{h.delivery_neighborhood}{h.delivery_city ? ` - ${h.delivery_city}` : ''}</p>}
                                    {h.delivery_notes && <p className="text-muted-foreground mt-0.5">📝 {h.delivery_notes}</p>}
                                  </div>
                                )}

                                {/* Notes */}
                                {h.notes && (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">📝 Observações:</span>
                                    <p>{h.notes}</p>
                                  </div>
                                )}

                                {/* Tracking / UTM */}
                                {hasTracking && (
                                  <div className="p-2 rounded-lg bg-muted/20 border border-border/10">
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
                                      <Globe className="h-3 w-3" /> Rastreamento
                                    </span>
                                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                                      {h.utm_source && (
                                        <div><span className="text-muted-foreground">Fonte:</span> <span className="font-medium">{h.utm_source}</span></div>
                                      )}
                                      {h.utm_campaign && (
                                        <div><span className="text-muted-foreground">Campanha:</span> <span className="font-medium">{h.utm_campaign}</span></div>
                                      )}
                                      {h.utm_medium && (
                                        <div><span className="text-muted-foreground">Mídia:</span> <span className="font-medium">{h.utm_medium}</span></div>
                                      )}
                                      {h.utm_content && (
                                        <div><span className="text-muted-foreground">Conteúdo:</span> <span className="font-medium">{h.utm_content}</span></div>
                                      )}
                                      {h.utm_term && (
                                        <div><span className="text-muted-foreground">Termo:</span> <span className="font-medium">{h.utm_term}</span></div>
                                      )}
                                      {h.utm_ad_link && (
                                        <div>
                                          <a href={h.utm_ad_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-accent flex items-center gap-1">
                                            <ExternalLink className="h-3 w-3" /> Ver anúncio
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                    {h.session_id && (
                                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">Sessão: {h.session_id.slice(0, 12)}...</p>
                                    )}
                                  </div>
                                )}

                                {/* Stripe ID */}
                                {h.stripe_payment_intent_id && (
                                  <p className="text-[10px] text-muted-foreground font-mono">Stripe: {h.stripe_payment_intent_id}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {orderHistory.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido encontrado</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Customers;
