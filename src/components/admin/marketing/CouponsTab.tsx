import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Plus, Ticket, Edit2, Trash2, Loader2, BarChart3, Users, DollarSign, TrendingUp, Calendar, Copy, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Coupon {
  id: string; code: string; description: string | null; discount_type: string;
  discount_value: number; is_active: boolean; expires_at: string | null;
  used_count: number; max_uses: number | null; min_order_value: number | null;
  tenant_id: string; created_at: string;
}

interface CouponUsage {
  id: string; customer_phone: string; discount_applied: number;
  order_total: number; used_at: string; order_id: string | null;
}

interface Props { tenantId: string | null; }

const CouponsTab = ({ tenantId }: Props) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [insightOpen, setInsightOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [usageData, setUsageData] = useState<CouponUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  // Form
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [maxUses, setMaxUses] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => { if (tenantId) fetchCoupons(); }, [tenantId]);

  const fetchCoupons = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase.from('coupons').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    setCoupons((data as Coupon[]) || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setCode('');
    setDescription('');
    setDiscountType('percentage');
    setDiscountValue('10');
    setMaxUses('');
    setMinOrderValue('');
    setExpiresAt('');
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setCode(c.code);
    setDescription(c.description || '');
    setDiscountType(c.discount_type);
    setDiscountValue(String(c.discount_value));
    setMaxUses(c.max_uses ? String(c.max_uses) : '');
    setMinOrderValue(c.min_order_value ? String(c.min_order_value) : '');
    setExpiresAt(c.expires_at ? c.expires_at.slice(0, 16) : '');
    setIsActive(c.is_active);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!tenantId || !code.trim()) { toast.error('Código obrigatório'); return; }
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      code: code.trim().toUpperCase(),
      description: description || null,
      discount_type: discountType,
      discount_value: Number(discountValue) || 0,
      max_uses: maxUses ? Number(maxUses) : null,
      min_order_value: minOrderValue ? Number(minOrderValue) : null,
      expires_at: expiresAt || null,
      is_active: isActive,
    };

    if (editing) {
      const { error } = await supabase.from('coupons').update(payload).eq('id', editing.id);
      if (error) toast.error(error.message); else toast.success('Cupom atualizado!');
    } else {
      const { error } = await supabase.from('coupons').insert(payload);
      if (error) toast.error(error.message); else toast.success('Cupom criado!');
    }
    setSaving(false);
    setDialogOpen(false);
    fetchCoupons();
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Excluir este cupom?')) return;
    await supabase.from('coupons').delete().eq('id', id);
    toast.success('Cupom excluído');
    fetchCoupons();
  };

  const openInsights = async (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setInsightOpen(true);
    setUsageLoading(true);
    const { data } = await supabase.from('coupon_usage').select('*').eq('coupon_id', coupon.id).order('used_at', { ascending: false });
    setUsageData((data as CouponUsage[]) || []);
    setUsageLoading(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  // Insights calculations
  const insights = useMemo(() => {
    if (!usageData.length) return null;
    const totalDiscount = usageData.reduce((s, u) => s + Number(u.discount_applied), 0);
    const totalRevenue = usageData.reduce((s, u) => s + Number(u.order_total), 0);
    const uniqueCustomers = new Set(usageData.map(u => u.customer_phone)).size;
    const avgTicket = totalRevenue / usageData.length;
    return { totalDiscount, totalRevenue, uniqueCustomers, avgTicket, uses: usageData.length };
  }, [usageData]);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // KPI summary
  const summaryKpis = useMemo(() => {
    const active = coupons.filter(c => c.is_active).length;
    const totalUsed = coupons.reduce((s, c) => s + c.used_count, 0);
    return { total: coupons.length, active, totalUsed };
  }, [coupons]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Cupons</p>
                <p className="text-2xl font-bold">{summaryKpis.total}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cupons Ativos</p>
                <p className="text-2xl font-bold text-emerald-400">{summaryKpis.active}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Usos</p>
                <p className="text-2xl font-bold">{summaryKpis.totalUsed}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="font-display font-semibold text-lg">Cupons de Desconto</h3>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Novo Cupom
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nenhum cupom criado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead className="text-center">Usos</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono font-bold">{c.code}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(c.code)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {c.discount_type === 'percentage' ? `${c.discount_value}%` : formatCurrency(c.discount_value)}
                      </Badge>
                      {c.min_order_value && c.min_order_value > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Min: {formatCurrency(c.min_order_value)}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold">{c.used_count}</span>
                      {c.max_uses && <span className="text-muted-foreground text-xs">/{c.max_uses}</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={c.is_active ? 'bg-emerald-500/20 text-emerald-400 border-0' : 'bg-muted text-muted-foreground border-0'}>
                        {c.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.expires_at ? (
                        <span className={`text-xs ${new Date(c.expires_at) < new Date() ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {format(new Date(c.expires_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">Sem limite</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openInsights(c)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCoupon(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cupom' : 'Novo Cupom'}</DialogTitle>
            <DialogDescription>Configure os detalhes do cupom de desconto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código</Label>
                <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="EX: VOLTA10" className="font-mono" />
              </div>
              <div>
                <Label>Tipo de Desconto</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor do Desconto</Label>
                <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'percentage' ? '10' : '5.00'} />
              </div>
              <div>
                <Label>Pedido Mínimo (R$)</Label>
                <Input type="number" value={minOrderValue} onChange={e => setMinOrderValue(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Cupom de reativação para clientes inativos" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Máximo de Usos</Label>
                <Input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Ilimitado" />
              </div>
              <div>
                <Label>Validade</Label>
                <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Cupom Ativo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ticket className="h-4 w-4 mr-2" />}
              {editing ? 'Salvar Alterações' : 'Criar Cupom'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Insights Sheet */}
      <Sheet open={insightOpen} onOpenChange={setInsightOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border/30">
          {selectedCoupon && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="font-display text-xl flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Insights: <code className="text-primary">{selectedCoupon.code}</code>
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-5 mt-2">
                {/* Coupon info */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/10 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {selectedCoupon.discount_type === 'percentage' ? `${selectedCoupon.discount_value}% OFF` : formatCurrency(selectedCoupon.discount_value) + ' OFF'}
                  </p>
                  {selectedCoupon.description && <p className="text-sm text-muted-foreground mt-1">{selectedCoupon.description}</p>}
                </div>

                {usageLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : insights ? (
                  <>
                    {/* KPI grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
                        <Users className="h-4 w-4 text-blue-400 mx-auto mb-1" />
                        <p className="font-bold text-lg">{insights.uniqueCustomers}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Clientes Únicos</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
                        <Ticket className="h-4 w-4 text-primary mx-auto mb-1" />
                        <p className="font-bold text-lg">{insights.uses}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Total de Usos</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
                        <DollarSign className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                        <p className="font-bold text-lg">{formatCurrency(insights.totalRevenue)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Receita Gerada</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
                        <TrendingUp className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                        <p className="font-bold text-lg">{formatCurrency(insights.avgTicket)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Ticket Médio</p>
                      </div>
                    </div>

                    {/* ROI */}
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-muted-foreground">Desconto Total Dado</p>
                            <p className="text-lg font-bold text-destructive">{formatCurrency(insights.totalDiscount)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">ROI do Cupom</p>
                            <p className={`text-lg font-bold ${insights.totalRevenue > insights.totalDiscount ? 'text-emerald-400' : 'text-destructive'}`}>
                              {insights.totalDiscount > 0 ? `${((insights.totalRevenue - insights.totalDiscount) / insights.totalDiscount * 100).toFixed(0)}%` : '—'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Usage timeline */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Histórico de Uso
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {usageData.map(u => (
                          <div key={u.id} className="flex justify-between items-center p-2.5 rounded-lg bg-muted/10 border border-border/10 text-sm">
                            <div>
                              <span className="font-medium">{u.customer_phone}</span>
                              <p className="text-xs text-muted-foreground">{format(new Date(u.used_at), "dd/MM/yy HH:mm", { locale: ptBR })}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(u.order_total)}</p>
                              <p className="text-xs text-destructive">-{formatCurrency(u.discount_applied)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Nenhum uso registrado ainda.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CouponsTab;
