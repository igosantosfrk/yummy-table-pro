import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, Target, ShoppingCart, RefreshCw, Settings2,
  Eye, MousePointer, ArrowUpRight, ArrowDownRight, Loader2, Plug, BarChart3
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  platform: 'meta' | 'google';
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  cost_per_result: number;
  revenue: number;
  orders: number;
  roi: number;
}

interface Summary {
  total_spend: number;
  total_revenue: number;
  total_orders: number;
  roi: number;
}

interface AdAccount {
  id: string;
  platform: string;
  account_id: string;
  access_token: string;
  account_name: string | null;
  is_active: boolean;
  last_synced_at: string | null;
}

const Marketing = () => {
  const { tenantId } = useAuth();
  const [tab, setTab] = useState('overview');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Form states
  const [metaToken, setMetaToken] = useState('');
  const [metaAccountId, setMetaAccountId] = useState('');
  const [metaAccountName, setMetaAccountName] = useState('');
  const [googleToken, setGoogleToken] = useState('');
  const [googleAccountId, setGoogleAccountId] = useState('');
  const [googleAccountName, setGoogleAccountName] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchAdAccounts();
    }
  }, [tenantId]);

  // Auto-polling: fetch campaigns every 30s when on overview tab with accounts connected
  useEffect(() => {
    if (!tenantId || !autoRefresh || tab !== 'overview') return;
    if (adAccounts.length === 0) return;

    // Initial fetch
    fetchCampaigns();

    const interval = setInterval(() => {
      fetchCampaigns();
    }, 30000);

    return () => clearInterval(interval);
  }, [tenantId, autoRefresh, tab, adAccounts.length]);

  const fetchAdAccounts = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('ad_accounts')
      .select('*')
      .eq('tenant_id', tenantId);

    if (data) {
      setAdAccounts(data as AdAccount[]);
      const meta = data.find((a: any) => a.platform === 'meta');
      const google = data.find((a: any) => a.platform === 'google');
      if (meta) {
        setMetaToken(meta.access_token);
        setMetaAccountId(meta.account_id);
        setMetaAccountName(meta.account_name || '');
      }
      if (google) {
        setGoogleToken(google.access_token);
        setGoogleAccountId(google.account_id);
        setGoogleAccountName(google.account_name || '');
      }
    }
  };

  const saveAdAccount = async (platform: 'meta' | 'google') => {
    if (!tenantId) return;
    const isMeta = platform === 'meta';
    const setter = isMeta ? setSavingMeta : setSavingGoogle;
    setter(true);

    const token = isMeta ? metaToken : googleToken;
    const accountId = isMeta ? metaAccountId : googleAccountId;
    const accountName = isMeta ? metaAccountName : googleAccountName;

    if (!token || !accountId) {
      toast.error('Preencha o token e o ID da conta');
      setter(false);
      return;
    }

    const existing = adAccounts.find(a => a.platform === platform);

    if (existing) {
      const { error } = await supabase
        .from('ad_accounts')
        .update({ access_token: token, account_id: accountId, account_name: accountName || null })
        .eq('id', existing.id);
      if (error) toast.error(error.message);
      else toast.success(`Conta ${isMeta ? 'Meta' : 'Google'} atualizada!`);
    } else {
      const { error } = await supabase
        .from('ad_accounts')
        .insert({ tenant_id: tenantId, platform, access_token: token, account_id: accountId, account_name: accountName || null });
      if (error) toast.error(error.message);
      else toast.success(`Conta ${isMeta ? 'Meta' : 'Google'} conectada!`);
    }

    setter(false);
    fetchAdAccounts();
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/fetch-ad-campaigns`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      setCampaigns(result.campaigns || []);
      setSummary(result.summary || null);
      setLastUpdated(new Date());
      if (result.errors?.length) setErrors(result.errors);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao buscar campanhas');
    }
    setLoading(false);
  };

  const hasAccounts = adAccounts.length > 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatPercent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Conexões
            </TabsTrigger>
          </TabsList>

          {tab === 'overview' && hasAccounts && (
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  Atualizado: {lastUpdated.toLocaleTimeString('pt-BR')}
                </span>
              )}
              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? '⏸ Pausar' : '▶ Auto-refresh'}
              </Button>
              <Button onClick={fetchCampaigns} disabled={loading} size="sm" variant="outline">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          )}
        </div>

        {/* CONNECTIONS TAB */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Meta Ads */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-base">Meta Ads</CardTitle>
                    <CardDescription>Facebook & Instagram</CardDescription>
                  </div>
                  {adAccounts.find(a => a.platform === 'meta') && (
                    <Badge className="ml-auto bg-success/20 text-success border-0">Conectado</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome da Conta (opcional)</Label>
                  <Input value={metaAccountName} onChange={e => setMetaAccountName(e.target.value)} placeholder="Ex: Minha Loja - Meta" />
                </div>
                <div>
                  <Label>Access Token</Label>
                  <Input type="password" value={metaToken} onChange={e => setMetaToken(e.target.value)} placeholder="Cole seu token de acesso do Meta" />
                </div>
                <div>
                  <Label>ID da Conta de Anúncios</Label>
                  <Input value={metaAccountId} onChange={e => setMetaAccountId(e.target.value)} placeholder="Ex: act_123456789" />
                </div>
                <Button onClick={() => saveAdAccount('meta')} disabled={savingMeta} className="w-full">
                  {savingMeta ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plug className="h-4 w-4 mr-2" />}
                  {adAccounts.find(a => a.platform === 'meta') ? 'Atualizar' : 'Conectar'}
                </Button>
              </CardContent>
            </Card>

            {/* Google Ads */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-base">Google Ads</CardTitle>
                    <CardDescription>Search, Display & YouTube</CardDescription>
                  </div>
                  {adAccounts.find(a => a.platform === 'google') && (
                    <Badge className="ml-auto bg-success/20 text-success border-0">Conectado</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome da Conta (opcional)</Label>
                  <Input value={googleAccountName} onChange={e => setGoogleAccountName(e.target.value)} placeholder="Ex: Minha Loja - Google" />
                </div>
                <div>
                  <Label>Access Token</Label>
                  <Input type="password" value={googleToken} onChange={e => setGoogleToken(e.target.value)} placeholder="Cole seu token de acesso do Google" />
                </div>
                <div>
                  <Label>ID do Cliente (Customer ID)</Label>
                  <Input value={googleAccountId} onChange={e => setGoogleAccountId(e.target.value)} placeholder="Ex: 123-456-7890" />
                </div>
                <Button onClick={() => saveAdAccount('google')} disabled={savingGoogle} className="w-full">
                  {savingGoogle ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plug className="h-4 w-4 mr-2" />}
                  {adAccounts.find(a => a.platform === 'google') ? 'Atualizar' : 'Conectar'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {!hasAccounts ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Plug className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Conecte suas contas de anúncios</h3>
                <p className="text-muted-foreground max-w-md mb-6">
                  Para visualizar suas campanhas e métricas, conecte pelo menos uma conta de anúncios na aba de Conexões.
                </p>
                <Button onClick={() => setTab('settings')}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Configurar Conexões
                </Button>
              </CardContent>
            </Card>
          ) : !summary ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Pronto para sincronizar</h3>
                <p className="text-muted-foreground max-w-md mb-6">
                  Clique em "Atualizar" para buscar os dados das suas campanhas em tempo real.
                </p>
                <Button onClick={fetchCampaigns} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Buscar Campanhas
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Errors */}
              {errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  {errors.map((err, i) => (
                    <p key={i} className="text-sm text-destructive">
                      <strong>{err.platform}:</strong> {err.error}
                    </p>
                  ))}
                </div>
              )}

              {/* KPI Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Investido Hoje</p>
                        <p className="text-2xl font-bold">{formatCurrency(summary.total_spend)}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-destructive" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Receita Hoje</p>
                        <p className="text-2xl font-bold">{formatCurrency(summary.total_revenue)}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-success" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pedidos Hoje</p>
                        <p className="text-2xl font-bold">{summary.total_orders}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
                        <ShoppingCart className="h-5 w-5 text-info" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">ROI Geral</p>
                        <p className={`text-2xl font-bold ${summary.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatPercent(summary.roi)}
                        </p>
                      </div>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${summary.roi >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                        {summary.roi >= 0
                          ? <ArrowUpRight className="h-5 w-5 text-success" />
                          : <ArrowDownRight className="h-5 w-5 text-destructive" />
                        }
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      (Receita - Investimento) / Investimento
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Campaigns Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Campanhas Ativas</CardTitle>
                  <CardDescription>
                    Métricas em tempo real das suas campanhas de tráfego pago
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {campaigns.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhuma campanha ativa encontrada.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campanha</TableHead>
                          <TableHead>Plataforma</TableHead>
                          <TableHead className="text-right">Investido</TableHead>
                          <TableHead className="text-right">Impressões</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">Resultados</TableHead>
                          <TableHead className="text-right">CPR</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                          <TableHead className="text-right">ROI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.map(campaign => (
                          <TableRow key={`${campaign.platform}-${campaign.id}`}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {campaign.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={campaign.platform === 'meta' ? 'border-blue-500/30 text-blue-400' : 'border-red-500/30 text-red-400'}>
                                {campaign.platform === 'meta' ? 'Meta' : 'Google'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.spend)}</TableCell>
                            <TableCell className="text-right">{campaign.impressions.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{campaign.clicks.toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-right">{campaign.results}</TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.cost_per_result)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(campaign.revenue)}</TableCell>
                            <TableCell className="text-right">
                              <span className={campaign.roi >= 0 ? 'text-success' : 'text-destructive'}>
                                {formatPercent(campaign.roi)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Marketing;
