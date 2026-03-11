import { useState, useEffect, useCallback } from 'react';
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
import { toast } from 'sonner';
import {
  Plus, Edit2, Trash2, Loader2, MessageSquare, Cake, Clock, CalendarDays,
  Send, Sparkles, Zap, BarChart3, Users, Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  campaign_type: string;
  template_message: string;
  coupon_id: string | null;
  is_active: boolean;
  inactive_days: number | null;
  frequency: string | null;
  send_day: number | null;
  send_hour: number | null;
  use_ai_personalization: boolean;
  total_sent: number;
  last_sent_at: string | null;
  created_at: string;
}

interface CampaignLog {
  id: string;
  campaign_id: string;
  customer_phone: string;
  message_sent: string;
  status: string;
  sent_at: string;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
}

interface Props { tenantId: string | null; }

const campaignTypeConfig: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  birthday: { label: 'Aniversariantes', icon: Cake, color: 'text-pink-400', desc: 'Envia automaticamente no dia do aniversário do cliente' },
  inactive: { label: 'Inativos', icon: Clock, color: 'text-amber-400', desc: 'Envia para clientes sem pedidos há X dias' },
  periodic: { label: 'Periódica', icon: CalendarDays, color: 'text-blue-400', desc: 'Envio recorrente (semanal, quinzenal ou mensal)' },
};

const frequencyLabels: Record<string, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
};

const WhatsAppAutomationTab = ({ tenantId }: Props) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [campaignType, setCampaignType] = useState('birthday');
  const [templateMsg, setTemplateMsg] = useState('');
  const [couponId, setCouponId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [inactiveDays, setInactiveDays] = useState('30');
  const [frequency, setFrequency] = useState('weekly');
  const [sendDay, setSendDay] = useState('1');
  const [sendHour, setSendHour] = useState('9');
  const [useAi, setUseAi] = useState(false);

  // Logs dialog
  const [logsOpen, setLogsOpen] = useState(false);
  const [selectedCampaignLogs, setSelectedCampaignLogs] = useState<CampaignLog[]>([]);
  const [selectedCampaignName, setSelectedCampaignName] = useState('');

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [cRes, lRes, couponRes] = await Promise.all([
      supabase.from('whatsapp_campaigns').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('whatsapp_campaign_logs').select('*').eq('tenant_id', tenantId).order('sent_at', { ascending: false }).limit(100),
      supabase.from('coupons').select('id, code, discount_type, discount_value, is_active').eq('tenant_id', tenantId).eq('is_active', true),
    ]);
    setCampaigns((cRes.data || []) as Campaign[]);
    setLogs((lRes.data || []) as CampaignLog[]);
    setCoupons((couponRes.data || []) as Coupon[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = (type: string) => {
    setEditing(null);
    setName('');
    setCampaignType(type);
    setCouponId('');
    setIsActive(true);
    setInactiveDays('30');
    setFrequency('weekly');
    setSendDay('1');
    setSendHour('9');
    setUseAi(type === 'inactive');

    // Default templates
    if (type === 'birthday') {
      setTemplateMsg('🎂 Parabéns, {{nome}}! Hoje é seu dia especial! 🎉\n\nPara comemorar, preparamos um presente exclusivo: use o cupom {{cupom}} e ganhe {{desconto}} de desconto no seu próximo pedido!\n\nPeça agora e celebre com a gente! 🎁');
    } else if (type === 'inactive') {
      setTemplateMsg('Olá, {{nome}}! 👋\n\nSentimos sua falta! Faz tempo que você não pede com a gente.\n\n{{mensagem_ia}}\n\nUse o cupom {{cupom}} e ganhe {{desconto}} de desconto! ❤️');
    } else {
      setTemplateMsg('Olá, {{nome}}! 😊\n\nTemos novidades especiais para você!\n\n{{mensagem_personalizada}}\n\nPeça agora pelo nosso cardápio digital! 🍽️');
    }
    setDialogOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setName(c.name);
    setCampaignType(c.campaign_type);
    setTemplateMsg(c.template_message);
    setCouponId(c.coupon_id || '');
    setIsActive(c.is_active);
    setInactiveDays(String(c.inactive_days || 30));
    setFrequency(c.frequency || 'weekly');
    setSendDay(String(c.send_day || 1));
    setSendHour(String(c.send_hour || 9));
    setUseAi(c.use_ai_personalization);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!tenantId || !name.trim() || !templateMsg.trim()) {
      toast.error('Preencha nome e mensagem');
      return;
    }
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      name: name.trim(),
      campaign_type: campaignType,
      template_message: templateMsg,
      coupon_id: couponId || null,
      is_active: isActive,
      inactive_days: campaignType === 'inactive' ? Number(inactiveDays) || 30 : null,
      frequency: campaignType === 'periodic' ? frequency : null,
      send_day: campaignType === 'periodic' ? Number(sendDay) || 1 : null,
      send_hour: Number(sendHour) || 9,
      use_ai_personalization: useAi,
    };

    if (editing) {
      const { error } = await supabase.from('whatsapp_campaigns').update(payload).eq('id', editing.id);
      if (error) toast.error(error.message); else toast.success('Campanha atualizada!');
    } else {
      const { error } = await supabase.from('whatsapp_campaigns').insert(payload);
      if (error) toast.error(error.message); else toast.success('Campanha criada!');
    }
    setSaving(false);
    setDialogOpen(false);
    fetchAll();
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Excluir esta campanha?')) return;
    await supabase.from('whatsapp_campaigns').delete().eq('id', id);
    toast.success('Campanha excluída');
    fetchAll();
  };

  const toggleActive = async (c: Campaign) => {
    await supabase.from('whatsapp_campaigns').update({ is_active: !c.is_active }).eq('id', c.id);
    toast.success(c.is_active ? 'Campanha pausada' : 'Campanha ativada');
    fetchAll();
  };

  const viewLogs = (c: Campaign) => {
    setSelectedCampaignName(c.name);
    setSelectedCampaignLogs(logs.filter(l => l.campaign_id === c.id));
    setLogsOpen(true);
  };

  // Stats
  const totalSent = campaigns.reduce((s, c) => s + c.total_sent, 0);
  const activeCampaigns = campaigns.filter(c => c.is_active).length;
  const todayLogs = logs.filter(l => {
    const d = new Date(l.sent_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Campanhas Ativas</p>
                <p className="text-2xl font-bold">{activeCampaigns}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Enviadas</p>
                <p className="text-2xl font-bold">{totalSent}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Send className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Enviadas Hoje</p>
                <p className="text-2xl font-bold">{todayLogs.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tipos Configurados</p>
                <p className="text-2xl font-bold">{new Set(campaigns.map(c => c.campaign_type)).size}/3</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Types */}
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(campaignTypeConfig).map(([type, config]) => {
          const Icon = config.icon;
          const existing = campaigns.filter(c => c.campaign_type === type);
          return (
            <Card key={type} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{config.label}</CardTitle>
                    <CardDescription className="text-xs">{config.desc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {existing.length > 0 ? (
                  <div className="space-y-2">
                    {existing.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/20">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className={c.is_active ? 'bg-emerald-500/20 text-emerald-400 border-0 text-[10px]' : 'bg-muted text-muted-foreground border-0 text-[10px]'}>
                              {c.is_active ? 'Ativo' : 'Pausado'}
                            </Badge>
                            {c.use_ai_personalization && (
                              <Badge className="bg-violet-500/20 text-violet-400 border-0 text-[10px]">
                                <Sparkles className="h-2.5 w-2.5 mr-0.5" /> IA
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">{c.total_sent} enviadas</span>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => viewLogs(c)}>
                            <BarChart3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(c)}>
                            <Zap className={`h-3.5 w-3.5 ${c.is_active ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCampaign(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full text-xs mt-1" onClick={() => openNew(type)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Nova Campanha
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full gap-2" onClick={() => openNew(type)}>
                    <Plus className="h-4 w-4" /> Criar Campanha
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Envios Recentes</CardTitle>
            <CardDescription>Últimas mensagens enviadas automaticamente</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 10).map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-sm">{l.customer_phone}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">{l.message_sent}</TableCell>
                    <TableCell>
                      <Badge className={l.status === 'sent' ? 'bg-emerald-500/20 text-emerald-400 border-0' : 'bg-destructive/20 text-destructive border-0'}>
                        {l.status === 'sent' ? 'Enviada' : 'Falha'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(l.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Campaign Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {editing ? 'Editar Campanha' : 'Nova Campanha'}
            </DialogTitle>
            <DialogDescription>
              {campaignTypeConfig[campaignType]?.desc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome da Campanha</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Aniversariantes do Mês" />
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={campaignType} onValueChange={setCampaignType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="birthday">🎂 Aniversariantes</SelectItem>
                  <SelectItem value="inactive">⏰ Clientes Inativos</SelectItem>
                  <SelectItem value="periodic">📅 Periódica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Inactive-specific */}
            {campaignType === 'inactive' && (
              <div>
                <Label>Dias sem pedir</Label>
                <Input type="number" value={inactiveDays} onChange={e => setInactiveDays(e.target.value)} placeholder="30" />
                <p className="text-xs text-muted-foreground mt-1">Clientes sem pedido há X dias receberão a mensagem</p>
              </div>
            )}

            {/* Periodic-specific */}
            {campaignType === 'periodic' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frequência</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Quinzenal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{frequency === 'monthly' ? 'Dia do Mês' : 'Dia da Semana'}</Label>
                  {frequency === 'monthly' ? (
                    <Input type="number" min="1" max="28" value={sendDay} onChange={e => setSendDay(e.target.value)} />
                  ) : (
                    <Select value={sendDay} onValueChange={setSendDay}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Segunda</SelectItem>
                        <SelectItem value="2">Terça</SelectItem>
                        <SelectItem value="3">Quarta</SelectItem>
                        <SelectItem value="4">Quinta</SelectItem>
                        <SelectItem value="5">Sexta</SelectItem>
                        <SelectItem value="6">Sábado</SelectItem>
                        <SelectItem value="0">Domingo</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label>Horário de Envio</Label>
              <Select value={sendHour} onValueChange={setSendHour}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 15 }, (_, i) => i + 7).map(h => (
                    <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Template da Mensagem</Label>
              <Textarea value={templateMsg} onChange={e => setTemplateMsg(e.target.value)} rows={5} placeholder="Use variáveis: {{nome}}, {{cupom}}, {{desconto}}, {{mensagem_ia}}" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['{{nome}}', '{{cupom}}', '{{desconto}}', '{{mensagem_ia}}', '{{mensagem_personalizada}}'].map(v => (
                  <Badge key={v} variant="outline" className="text-[10px] cursor-pointer hover:bg-accent" onClick={() => setTemplateMsg(prev => prev + ' ' + v)}>
                    {v}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Cupom de Desconto (opcional)</Label>
              <Select value={couponId || 'none'} onValueChange={v => setCouponId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sem cupom" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cupom</SelectItem>
                  {coupons.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.discount_value}{c.discount_type === 'percentage' ? '%' : ' R$'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {campaignType === 'inactive' && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-violet-500/5 border border-violet-500/15">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <div>
                    <p className="text-sm font-medium">Personalização com IA</p>
                    <p className="text-xs text-muted-foreground">Gera mensagem baseada no histórico do cliente</p>
                  </div>
                </div>
                <Switch checked={useAi} onCheckedChange={setUseAi} />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Campanha Ativa</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              {editing ? 'Salvar' : 'Criar Campanha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de Envios — {selectedCampaignName}</DialogTitle>
          </DialogHeader>
          {selectedCampaignLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum envio registrado ainda.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {selectedCampaignLogs.map(l => (
                <div key={l.id} className="p-3 rounded-lg bg-muted/20 border border-border/20">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-sm">{l.customer_phone}</span>
                    <Badge className={l.status === 'sent' ? 'bg-emerald-500/20 text-emerald-400 border-0' : 'bg-destructive/20 text-destructive border-0'}>
                      {l.status === 'sent' ? 'Enviada' : 'Falha'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.message_sent}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(l.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppAutomationTab;
