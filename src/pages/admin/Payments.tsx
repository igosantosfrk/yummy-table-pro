import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';
import {
  DollarSign, TrendingUp, ShoppingCart, Percent, ArrowUpCircle, ArrowDownCircle,
  BarChart3, Plus, Trash2, Receipt, PiggyBank, Wallet, Calculator, Package
} from 'lucide-react';

interface FinancialEntry {
  id: string;
  type: 'income' | 'expense';
  category: string;
  description: string | null;
  amount: number;
  date: string;
  is_recurring: boolean;
}

const expenseCategories = [
  'Aluguel', 'Funcionários', 'Fornecedores', 'Embalagens', 'Marketing',
  'Manutenção', 'Energia/Água/Gás', 'Internet/Telefone', 'Impostos',
  'Delivery (apps)', 'Equipamentos', 'Limpeza', 'Outros',
];

const incomeCategories = [
  'Vendas Delivery', 'Vendas Balcão', 'Eventos', 'Outros',
];

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const Payments = () => {
  const { tenantId } = useAuth();
  const { preset, setPreset, dateRange, customRange, setCustomRange } = useDateRange('thisMonth');
  const [orders, setOrders] = useState<any[]>([]);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({ type: 'expense' as 'income' | 'expense', category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0] });

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const [{ data: ordersData }, { data: entriesData }] = await Promise.all([
      supabase.from('orders').select('total, subtotal, delivery_fee, discount, payment_method, status')
        .eq('tenant_id', tenantId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString()),
      supabase.from('financial_entries').select('*')
        .eq('tenant_id', tenantId)
        .gte('date', dateRange.from.toISOString().split('T')[0])
        .lte('date', dateRange.to.toISOString().split('T')[0])
        .order('date', { ascending: false }),
    ]);

    setOrders((ordersData || []).filter(o => o.status !== 'cancelled'));
    setEntries((entriesData || []) as FinancialEntry[]);
    setLoading(false);
  }, [tenantId, dateRange.from, dateRange.to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addEntry = async () => {
    if (!newEntry.category || !newEntry.amount) {
      toast({ title: 'Preencha categoria e valor', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('financial_entries').insert({
      tenant_id: tenantId, type: newEntry.type, category: newEntry.category,
      description: newEntry.description || null, amount: parseFloat(newEntry.amount), date: newEntry.date,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Lançamento adicionado!' });
    setDialogOpen(false);
    setNewEntry({ type: 'expense', category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0] });
    fetchData();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('financial_entries').delete().eq('id', id);
    fetchData();
  };

  // Calculations
  const receitaBruta = orders.reduce((s, o) => s + Number(o.total), 0);
  const totalDeliveryFees = orders.reduce((s, o) => s + Number(o.delivery_fee), 0);
  const totalDescontos = orders.reduce((s, o) => s + Number(o.discount || 0), 0);
  const totalPedidos = orders.length;
  const ticketMedio = totalPedidos > 0 ? receitaBruta / totalPedidos : 0;

  const manualIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const manualExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0);

  const totalEntradas = receitaBruta + manualIncome;
  const totalSaidas = manualExpense;
  const lucroReal = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? (lucroReal / totalEntradas) * 100 : 0;

  // Group expenses by category
  const expenseByCategory = entries.filter(e => e.type === 'expense').reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  // Payment breakdown
  const paymentBreakdown: Record<string, { count: number; total: number }> = {};
  orders.forEach(o => {
    const m = o.payment_method || 'outros';
    if (!paymentBreakdown[m]) paymentBreakdown[m] = { count: 0, total: 0 };
    paymentBreakdown[m].count++;
    paymentBreakdown[m].total += Number(o.total);
  });
  const methodLabels: Record<string, string> = { pix: 'PIX', credit_card: 'Cartão Crédito', debit_card: 'Cartão Débito', cash: 'Dinheiro', online: 'Online' };

  const EntryForm = () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={newEntry.type === 'expense' ? 'default' : 'outline'}
          className={newEntry.type === 'expense' ? 'gradient-primary text-white' : ''}
          onClick={() => setNewEntry({ ...newEntry, type: 'expense', category: '' })}>Saída</Button>
        <Button size="sm" variant={newEntry.type === 'income' ? 'default' : 'outline'}
          className={newEntry.type === 'income' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
          onClick={() => setNewEntry({ ...newEntry, type: 'income', category: '' })}>Entrada</Button>
      </div>
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select value={newEntry.category} onValueChange={v => setNewEntry({ ...newEntry, category: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {(newEntry.type === 'expense' ? expenseCategories : incomeCategories).map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Descrição (opcional)</Label>
        <Input value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} placeholder="Ex: Conta de luz março" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input type="number" value={newEntry.amount} onChange={e => setNewEntry({ ...newEntry, amount: e.target.value })} placeholder="0,00" />
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={newEntry.date} onChange={e => setNewEntry({ ...newEntry, date: e.target.value })} />
        </div>
      </div>
      <Button onClick={addEntry} className="w-full gradient-primary text-white">
        <Plus className="h-4 w-4 mr-2" /> Adicionar Lançamento
      </Button>
    </div>
  );

  const EntriesTable = ({ type }: { type: 'income' | 'expense' }) => {
    const filtered = entries.filter(e => e.type === type);
    const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{filtered.length} lançamentos</p>
            <p className="text-2xl font-bold" style={{ color: type === 'income' ? '#16a34a' : '#ea580c' }}>{fmt(total)}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => { setNewEntry({ ...newEntry, type }); setDialogOpen(true); }} className="gradient-primary text-white">
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
              <EntryForm />
            </DialogContent>
          </Dialog>
        </div>
        {filtered.length === 0 ? (
          <Card className="glass"><CardContent className="py-12 text-center text-muted-foreground">Nenhum lançamento no período</CardContent></Card>
        ) : (
          <Card className="glass">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{e.category}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.description || '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(e.amount)}</TableCell>
                    <TableCell>
                      <button onClick={() => deleteEntry(e.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-display font-bold">Financeiro</h1>
        <DateRangeFilter preset={preset} onPresetChange={setPreset} customRange={customRange} onCustomRangeChange={setCustomRange} />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="bg-muted/30 border border-border/20">
          <TabsTrigger value="dashboard" className="gap-1.5 data-[state=active]:bg-white"><BarChart3 className="h-4 w-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="income" className="gap-1.5 data-[state=active]:bg-white"><ArrowUpCircle className="h-4 w-4" /> Entradas</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5 data-[state=active]:bg-white"><ArrowDownCircle className="h-4 w-4" /> Saídas</TabsTrigger>
          <TabsTrigger value="dre" className="gap-1.5 data-[state=active]:bg-white"><Receipt className="h-4 w-4" /> DRE</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Receita Bruta', value: fmt(receitaBruta), icon: DollarSign, color: 'text-emerald-600' },
              { label: 'CMV (Custo Produtos)', value: fmt(0), icon: Package, color: 'text-amber-600' },
              { label: 'Custos Operacionais', value: fmt(totalSaidas), icon: Wallet, color: 'text-red-500' },
              { label: 'Lucro Líquido', value: fmt(lucroReal), icon: TrendingUp, color: lucroReal >= 0 ? 'text-emerald-600' : 'text-red-500' },
              { label: 'Pedidos', value: totalPedidos.toString(), icon: ShoppingCart, color: 'text-primary' },
              { label: 'Ticket Médio', value: fmt(ticketMedio), icon: PiggyBank, color: 'text-blue-600' },
              { label: 'Margem de Lucro', value: `${margem.toFixed(1)}%`, icon: Percent, color: margem >= 0 ? 'text-emerald-600' : 'text-red-500' },
              { label: 'Descontos', value: fmt(totalDescontos), icon: ArrowDownCircle, color: 'text-orange-500' },
            ].map(k => (
              <Card key={k.label} className="glass">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                      <p className="text-xl font-bold mt-1">{k.value}</p>
                    </div>
                    <k.icon className={`h-5 w-5 ${k.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="glass border-emerald-100">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <ArrowUpCircle className="h-4 w-4 text-emerald-500" /> Total Entradas
                </div>
                <p className="text-2xl font-bold text-emerald-600">{fmt(totalEntradas)}</p>
              </CardContent>
            </Card>
            <Card className="glass border-red-100">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <ArrowDownCircle className="h-4 w-4 text-red-500" /> Total Saídas
                </div>
                <p className="text-2xl font-bold text-red-500">{fmt(totalSaidas)}</p>
              </CardContent>
            </Card>
            <Card className="glass" style={{ borderColor: lucroReal >= 0 ? '#dcfce7' : '#fecaca' }}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className={`h-4 w-4 ${lucroReal >= 0 ? 'text-emerald-500' : 'text-red-500'}`} /> Lucro Real
                </div>
                <p className={`text-2xl font-bold ${lucroReal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(lucroReal)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Breakdown */}
          <Card className="glass">
            <CardHeader><CardTitle className="font-display text-base">Receita por Forma de Pagamento</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(paymentBreakdown).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum pedido no período</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(paymentBreakdown).sort((a, b) => b[1].total - a[1].total).map(([m, v]) => (
                      <TableRow key={m}>
                        <TableCell className="font-medium">{methodLabels[m] || m}</TableCell>
                        <TableCell className="text-right">{v.count}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">{fmt(v.total)}</TableCell>
                        <TableCell className="text-right">{receitaBruta > 0 ? ((v.total / receitaBruta) * 100).toFixed(1) : '0.0'}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENTRADAS */}
        <TabsContent value="income" className="mt-4">
          <EntriesTable type="income" />
        </TabsContent>

        {/* SAÍDAS */}
        <TabsContent value="expenses" className="mt-4">
          <EntriesTable type="expense" />
        </TabsContent>

        {/* DRE */}
        <TabsContent value="dre" className="mt-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Demonstrativo de Resultado (DRE)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="font-semibold">Receita Bruta de Vendas</span>
                  <span className="font-bold text-emerald-600">{fmt(receitaBruta)}</span>
                </div>
                <div className="flex justify-between py-1.5 pl-4 text-sm text-muted-foreground">
                  <span>(-) Descontos concedidos</span>
                  <span className="text-red-500">- {fmt(totalDescontos)}</span>
                </div>
                <div className="flex justify-between py-1.5 pl-4 text-sm text-muted-foreground">
                  <span>(+) Outras receitas</span>
                  <span className="text-emerald-600">+ {fmt(manualIncome)}</span>
                </div>
                <div className="flex justify-between py-2 border-t border-b border-border/30 bg-muted/20 px-2 rounded">
                  <span className="font-semibold">Receita Líquida</span>
                  <span className="font-bold">{fmt(receitaBruta - totalDescontos + manualIncome)}</span>
                </div>

                <div className="pt-3" />
                <div className="flex justify-between py-1.5 pl-4 text-sm text-muted-foreground">
                  <span>(-) Taxas de entrega (custo)</span>
                  <span className="text-red-500">- {fmt(totalDeliveryFees)}</span>
                </div>

                {Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                  <div key={cat} className="flex justify-between py-1.5 pl-4 text-sm text-muted-foreground">
                    <span>(-) {cat}</span>
                    <span className="text-red-500">- {fmt(val)}</span>
                  </div>
                ))}

                <div className="flex justify-between py-2 border-t border-b border-border/30 bg-muted/20 px-2 rounded mt-2">
                  <span className="font-semibold">Total Despesas Operacionais</span>
                  <span className="font-bold text-red-500">- {fmt(totalSaidas + totalDeliveryFees)}</span>
                </div>

                <div className="pt-3" />
                <div className={`flex justify-between py-3 border-t-2 border-b-2 px-2 rounded-lg ${lucroReal >= 0 ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                  <span className="font-bold text-lg">RESULTADO LÍQUIDO</span>
                  <span className={`font-bold text-xl ${lucroReal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(receitaBruta - totalDescontos + manualIncome - totalSaidas - totalDeliveryFees)}
                  </span>
                </div>

                {totalEntradas > 0 && (
                  <div className="flex justify-between py-2 pl-2 text-sm">
                    <span className="text-muted-foreground">Margem de Lucro</span>
                    <span className={`font-semibold ${margem >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{margem.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Payments;
