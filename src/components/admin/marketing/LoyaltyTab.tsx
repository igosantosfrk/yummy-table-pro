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
import { Plus, Gift, Award, Edit2, Trash2, Loader2, Star, Users, DollarSign, TrendingUp, Crown, Coins, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LoyaltyProgram {
  id: string; name: string; description: string | null;
  points_per_real: number; is_active: boolean;
  tenant_id: string; created_at: string;
}

interface LoyaltyReward {
  id: string; program_id: string; name: string; description: string | null;
  reward_type: string; reward_value: number; points_required: number;
  is_active: boolean; tenant_id: string;
}

interface LoyaltyTransaction {
  id: string; customer_id: string; type: string; points: number;
  description: string | null; created_at: string;
}

interface CustomerSummary {
  id: string; name: string; phone: string; loyalty_points: number;
  total_spent: number; total_orders: number;
}

interface Props { tenantId: string | null; }

const LoyaltyTab = ({ tenantId }: Props) => {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Program dialog
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPointsPerReal, setPPointsPerReal] = useState('1');
  const [pActive, setPActive] = useState(true);
  const [savingProgram, setSavingProgram] = useState(false);

  // Reward dialog
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [rName, setRName] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rType, setRType] = useState('cashback');
  const [rValue, setRValue] = useState('');
  const [rPoints, setRPoints] = useState('100');
  const [rProgramId, setRProgramId] = useState('');
  const [rActive, setRActive] = useState(true);
  const [savingReward, setSavingReward] = useState(false);

  // Redeem
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCustomer, setRedeemCustomer] = useState<CustomerSummary | null>(null);
  const [redeemRewardId, setRedeemRewardId] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => { if (tenantId) fetchAll(); }, [tenantId]);

  const fetchAll = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [pRes, rRes, tRes, cRes] = await Promise.all([
      supabase.from('loyalty_programs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('loyalty_rewards').select('*').eq('tenant_id', tenantId),
      supabase.from('loyalty_transactions').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
      supabase.from('customers').select('id, name, phone, loyalty_points, total_spent, total_orders').eq('tenant_id', tenantId).order('loyalty_points', { ascending: false }).limit(20),
    ]);
    setPrograms((pRes.data || []) as LoyaltyProgram[]);
    setRewards((rRes.data || []) as LoyaltyReward[]);
    setTransactions((tRes.data || []) as LoyaltyTransaction[]);
    setTopCustomers((cRes.data || []) as CustomerSummary[]);
    setLoading(false);
  };

  // Program CRUD
  const openNewProgram = () => {
    setEditingProgram(null);
    setPName(''); setPDesc(''); setPPointsPerReal('1'); setPActive(true);
    setProgramDialogOpen(true);
  };

  const openEditProgram = (p: LoyaltyProgram) => {
    setEditingProgram(p);
    setPName(p.name); setPDesc(p.description || '');
    setPPointsPerReal(String(p.points_per_real)); setPActive(p.is_active);
    setProgramDialogOpen(true);
  };

  const saveProgram = async () => {
    if (!tenantId || !pName.trim()) { toast.error('Nome obrigatório'); return; }
    setSavingProgram(true);
    const payload = {
      tenant_id: tenantId, name: pName.trim(), description: pDesc || null,
      points_per_real: Number(pPointsPerReal) || 1, is_active: pActive,
    };
    if (editingProgram) {
      const { error } = await supabase.from('loyalty_programs').update(payload).eq('id', editingProgram.id);
      if (error) toast.error(error.message); else toast.success('Programa atualizado!');
    } else {
      const { error } = await supabase.from('loyalty_programs').insert(payload);
      if (error) toast.error(error.message); else toast.success('Programa criado!');
    }
    setSavingProgram(false);
    setProgramDialogOpen(false);
    fetchAll();
  };

  const deleteProgram = async (id: string) => {
    if (!confirm('Excluir este programa?')) return;
    await supabase.from('loyalty_programs').delete().eq('id', id);
    toast.success('Programa excluído');
    fetchAll();
  };

  // Reward CRUD
  const openNewReward = () => {
    setEditingReward(null);
    setRName(''); setRDesc(''); setRType('cashback'); setRValue(''); setRPoints('100'); setRActive(true);
    setRProgramId(programs[0]?.id || '');
    setRewardDialogOpen(true);
  };

  const openEditReward = (r: LoyaltyReward) => {
    setEditingReward(r);
    setRName(r.name); setRDesc(r.description || ''); setRType(r.reward_type);
    setRValue(String(r.reward_value)); setRPoints(String(r.points_required));
    setRProgramId(r.program_id); setRActive(r.is_active);
    setRewardDialogOpen(true);
  };

  const saveReward = async () => {
    if (!tenantId || !rName.trim() || !rProgramId) { toast.error('Preencha todos os campos'); return; }
    setSavingReward(true);
    const payload = {
      tenant_id: tenantId, program_id: rProgramId, name: rName.trim(),
      description: rDesc || null, reward_type: rType,
      reward_value: Number(rValue) || 0, points_required: Number(rPoints) || 100, is_active: rActive,
    };
    if (editingReward) {
      const { error } = await supabase.from('loyalty_rewards').update(payload).eq('id', editingReward.id);
      if (error) toast.error(error.message); else toast.success('Prêmio atualizado!');
    } else {
      const { error } = await supabase.from('loyalty_rewards').insert(payload);
      if (error) toast.error(error.message); else toast.success('Prêmio criado!');
    }
    setSavingReward(false);
    setRewardDialogOpen(false);
    fetchAll();
  };

  const deleteReward = async (id: string) => {
    if (!confirm('Excluir este prêmio?')) return;
    await supabase.from('loyalty_rewards').delete().eq('id', id);
    toast.success('Prêmio excluído');
    fetchAll();
  };

  // Manual redeem
  const openRedeem = (customer: CustomerSummary) => {
    setRedeemCustomer(customer);
    setRedeemRewardId('');
    setRedeemOpen(true);
  };

  const executeRedeem = async () => {
    if (!redeemCustomer || !redeemRewardId || !tenantId) return;
    const reward = rewards.find(r => r.id === redeemRewardId);
    if (!reward) return;
    if (redeemCustomer.loyalty_points < reward.points_required) {
      toast.error('Pontos insuficientes');
      return;
    }
    setRedeeming(true);

    // Create transaction
    await supabase.from('loyalty_transactions').insert({
      tenant_id: tenantId,
      customer_id: redeemCustomer.id,
      program_id: reward.program_id,
      reward_id: reward.id,
      type: 'redeem',
      points: -reward.points_required,
      description: `Resgate: ${reward.name}`,
    });

    // Update customer points
    await supabase.from('customers').update({
      loyalty_points: redeemCustomer.loyalty_points - reward.points_required,
    }).eq('id', redeemCustomer.id);

    toast.success(`Prêmio "${reward.name}" resgatado para ${redeemCustomer.name}!`);
    setRedeeming(false);
    setRedeemOpen(false);
    fetchAll();
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const activeProgram = programs.find(p => p.is_active);
  const activeRewards = rewards.filter(r => r.is_active);
  const totalPointsCirculating = topCustomers.reduce((s, c) => s + c.loyalty_points, 0);

  const rewardTypeLabels: Record<string, string> = {
    cashback: 'Cashback',
    discount: 'Desconto',
    free_product: 'Produto Grátis',
    free_delivery: 'Frete Grátis',
    custom: 'Personalizado',
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Programas Ativos</p>
                <p className="text-2xl font-bold">{programs.filter(p => p.is_active).length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Crown className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prêmios Disponíveis</p>
                <p className="text-2xl font-bold">{activeRewards.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Gift className="h-5 w-5 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pontos em Circulação</p>
                <p className="text-2xl font-bold">{totalPointsCirculating.toLocaleString('pt-BR')}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                <Coins className="h-5 w-5 text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resgates Realizados</p>
                <p className="text-2xl font-bold">{transactions.filter(t => t.type === 'redeem').length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Award className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Programs Section */}
      <div className="flex justify-between items-center">
        <h3 className="font-display font-semibold text-lg">Programas de Fidelidade</h3>
        <Button onClick={openNewProgram} size="sm"><Plus className="h-4 w-4 mr-2" /> Novo Programa</Button>
      </div>

      {programs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Crown className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Crie seu primeiro programa de fidelidade.</p>
            <p className="text-xs text-muted-foreground mt-1">Clientes acumulam pontos a cada pedido e trocam por prêmios.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programs.map(p => (
            <Card key={p.id} className={!p.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{p.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Badge className={p.is_active ? 'bg-emerald-500/20 text-emerald-400 border-0' : 'bg-muted text-muted-foreground border-0'}>
                      {p.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditProgram(p)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteProgram(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {p.description && <CardDescription>{p.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <Coins className="h-4 w-4 text-amber-400" />
                  <span>R$ 1,00 gasto = <strong>{p.points_per_real} ponto{p.points_per_real !== 1 ? 's' : ''}</strong></span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {rewards.filter(r => r.program_id === p.id).length} prêmio(s) cadastrado(s)
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rewards Section */}
      {programs.length > 0 && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-display font-semibold text-lg">Catálogo de Prêmios</h3>
            <Button onClick={openNewReward} size="sm"><Plus className="h-4 w-4 mr-2" /> Novo Prêmio</Button>
          </div>

          {rewards.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Gift className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Adicione prêmios para os clientes resgatarem.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {rewards.map(r => (
                <Card key={r.id} className={!r.is_active ? 'opacity-60' : ''}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{r.name}</p>
                        {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditReward(r)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteReward(r.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge variant="outline">{rewardTypeLabels[r.reward_type] || r.reward_type}</Badge>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{r.points_required}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">pontos</p>
                      </div>
                    </div>
                    {r.reward_value > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Valor: {r.reward_type === 'cashback' || r.reward_type === 'discount' ? formatCurrency(r.reward_value) : `${r.reward_value}`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Top Customers Ranking */}
      {topCustomers.length > 0 && (
        <>
          <h3 className="font-display font-semibold text-lg">Ranking de Clientes</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Pontos</TableHead>
                    <TableHead className="text-center">Pedidos</TableHead>
                    <TableHead className="text-right">Total Gasto</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.map((c, i) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        {i < 3 ? (
                          <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                        ) : (
                          <span className="text-muted-foreground">{i + 1}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          <Star className="h-3 w-3 text-amber-400" />
                          {c.loyalty_points}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{c.total_orders}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(c.total_spent)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openRedeem(c)} disabled={c.loyalty_points < 1}>
                          <Gift className="h-3.5 w-3.5 mr-1" /> Resgatar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Program Dialog */}
      <Dialog open={programDialogOpen} onOpenChange={setProgramDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProgram ? 'Editar Programa' : 'Novo Programa de Fidelidade'}</DialogTitle>
            <DialogDescription>Configure as regras de acúmulo de pontos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome do Programa</Label>
              <Input value={pName} onChange={e => setPName(e.target.value)} placeholder="Ex: Programa VIP" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={pDesc} onChange={e => setPDesc(e.target.value)} placeholder="Descrição do programa" rows={2} />
            </div>
            <div>
              <Label>Pontos por R$ 1,00 gasto</Label>
              <Input type="number" value={pPointsPerReal} onChange={e => setPPointsPerReal(e.target.value)} placeholder="1" />
              <p className="text-xs text-muted-foreground mt-1">Ex: Se 1, cada R$ 100 gastos = 100 pontos</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Programa Ativo</Label>
              <Switch checked={pActive} onCheckedChange={setPActive} />
            </div>
            <Button onClick={saveProgram} disabled={savingProgram} className="w-full">
              {savingProgram ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
              {editingProgram ? 'Salvar' : 'Criar Programa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reward Dialog */}
      <Dialog open={rewardDialogOpen} onOpenChange={setRewardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingReward ? 'Editar Prêmio' : 'Novo Prêmio'}</DialogTitle>
            <DialogDescription>Configure o prêmio que os clientes podem resgatar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Programa</Label>
              <Select value={rProgramId} onValueChange={setRProgramId}>
                <SelectTrigger><SelectValue placeholder="Selecione o programa" /></SelectTrigger>
                <SelectContent>
                  {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do Prêmio</Label>
              <Input value={rName} onChange={e => setRName(e.target.value)} placeholder="Ex: R$ 10 de cashback" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={rDesc} onChange={e => setRDesc(e.target.value)} rows={2} placeholder="Descrição do prêmio" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Prêmio</Label>
                <Select value={rType} onValueChange={setRType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashback">Cashback (R$)</SelectItem>
                    <SelectItem value="discount">Desconto (%)</SelectItem>
                    <SelectItem value="free_product">Produto Grátis</SelectItem>
                    <SelectItem value="free_delivery">Frete Grátis</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor</Label>
                <Input type="number" value={rValue} onChange={e => setRValue(e.target.value)} placeholder="10" />
              </div>
            </div>
            <div>
              <Label>Pontos Necessários</Label>
              <Input type="number" value={rPoints} onChange={e => setRPoints(e.target.value)} placeholder="100" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Prêmio Ativo</Label>
              <Switch checked={rActive} onCheckedChange={setRActive} />
            </div>
            <Button onClick={saveReward} disabled={savingReward} className="w-full">
              {savingReward ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
              {editingReward ? 'Salvar' : 'Criar Prêmio'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Redeem Dialog */}
      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Resgatar Prêmio</DialogTitle>
            <DialogDescription>
              {redeemCustomer && `${redeemCustomer.name} · ${redeemCustomer.loyalty_points} pontos disponíveis`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Selecione o Prêmio</Label>
              <Select value={redeemRewardId} onValueChange={setRedeemRewardId}>
                <SelectTrigger><SelectValue placeholder="Escolha um prêmio" /></SelectTrigger>
                <SelectContent>
                  {activeRewards.map(r => (
                    <SelectItem key={r.id} value={r.id} disabled={redeemCustomer ? redeemCustomer.loyalty_points < r.points_required : true}>
                      {r.name} ({r.points_required} pts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={executeRedeem} disabled={redeeming || !redeemRewardId} className="w-full">
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Confirmar Resgate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoyaltyTab;
