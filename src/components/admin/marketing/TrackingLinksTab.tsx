import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Copy, QrCode, Trash2, ExternalLink, Link2, Eye, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface TrackingLink {
  id: string;
  name: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  full_url: string;
  is_active: boolean;
  created_at: string;
}

interface LinkInsights {
  clicks: number;
  orders: number;
  revenue: number;
  conversion: number;
}

const sourcePresets = [
  { label: 'Facebook', value: 'facebook' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Google', value: 'google' },
  { label: 'Google Meu Negócio', value: 'google_meu_negocio' },
  { label: 'QR Code', value: 'qrcode' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'Email', value: 'email' },
  { label: 'Panfleto', value: 'panfleto' },
  { label: 'Outro', value: 'outro' },
];

const mediumPresets = [
  { label: 'CPC (Pago)', value: 'cpc' },
  { label: 'CPM', value: 'cpm' },
  { label: 'Orgânico', value: 'organic' },
  { label: 'Social', value: 'social' },
  { label: 'QR Code', value: 'qrcode' },
  { label: 'Email', value: 'email' },
  { label: 'Referência', value: 'referral' },
  { label: 'Offline', value: 'offline' },
];

interface Props {
  tenantId: string | null;
}

export default function TrackingLinksTab({ tenantId }: Props) {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [qrLink, setQrLink] = useState<TrackingLink | null>(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [insightsMap, setInsightsMap] = useState<Record<string, LinkInsights>>({});

  // Form
  const [name, setName] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetchLinks();
    fetchSlug();
  }, [tenantId]);

  const fetchSlug = async () => {
    if (!tenantId) return;
    const { data } = await supabase.from('tenants').select('slug').eq('id', tenantId).single();
    if (data) setTenantSlug(data.slug);
  };

  const fetchLinks = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('tracking_links' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    const fetchedLinks = (data as any[] || []) as TrackingLink[];
    setLinks(fetchedLinks);

    // Fetch insights for all links
    if (fetchedLinks.length > 0) {
      await fetchInsights(fetchedLinks);
    }
    setLoading(false);
  };

  const fetchInsights = async (linksToCheck: TrackingLink[]) => {
    if (!tenantId) return;

    // Get all page views for this tenant
    const { data: pageViews } = await supabase
      .from('menu_page_views' as any)
      .select('utm_source, utm_medium, utm_campaign, utm_term, utm_content')
      .eq('tenant_id', tenantId)
      .eq('page_type', 'menu_home');

    // Get all orders with UTMs
    const { data: orders } = await supabase
      .from('orders')
      .select('utm_source, utm_medium, utm_campaign, utm_term, utm_content, total, status')
      .eq('tenant_id', tenantId);

    const insights: Record<string, LinkInsights> = {};

    for (const link of linksToCheck) {
      // Match page views by UTM params
      const matchingViews = (pageViews as any[] || []).filter((pv: any) => matchUtm(link, pv));
      const clicks = matchingViews.length;

      // Match orders by UTM params
      const matchingOrders = (orders || []).filter((o: any) => o.status !== 'cancelled' && matchUtm(link, o));
      const orderCount = matchingOrders.length;
      const revenue = matchingOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
      const conversion = clicks > 0 ? (orderCount / clicks) * 100 : 0;

      insights[link.id] = { clicks, orders: orderCount, revenue, conversion };
    }

    setInsightsMap(insights);
  };

  /** Match a tracking link's UTMs against a record's UTMs. Only compares non-null link params. */
  const matchUtm = (link: TrackingLink, record: any): boolean => {
    if (link.utm_source && record.utm_source !== link.utm_source) return false;
    if (link.utm_medium && record.utm_medium !== link.utm_medium) return false;
    if (link.utm_campaign && record.utm_campaign !== link.utm_campaign) return false;
    if (link.utm_term && record.utm_term !== link.utm_term) return false;
    if (link.utm_content && record.utm_content !== link.utm_content) return false;
    // At least one param must match
    return !!(link.utm_source || link.utm_medium || link.utm_campaign || link.utm_term || link.utm_content);
  };

  const buildUrl = () => {
    const base = `${window.location.origin}/${tenantSlug}`;
    const params = new URLSearchParams();
    if (utmSource) params.set('utm_source', utmSource);
    if (utmMedium) params.set('utm_medium', utmMedium);
    if (utmCampaign) params.set('utm_campaign', utmCampaign);
    if (utmTerm) params.set('utm_term', utmTerm);
    if (utmContent) params.set('utm_content', utmContent);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const previewUrl = buildUrl();

  const handleSave = async () => {
    if (!tenantId || !name.trim()) { toast.error('Dê um nome para o link'); return; }
    if (!utmSource) { toast.error('Selecione a fonte (UTM Source)'); return; }
    setSaving(true);
    const fullUrl = buildUrl();

    const { error } = await supabase.from('tracking_links' as any).insert({
      tenant_id: tenantId, name: name.trim(),
      utm_source: utmSource || null, utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null, utm_term: utmTerm || null,
      utm_content: utmContent || null, full_url: fullUrl,
    } as any);

    if (error) toast.error(error.message);
    else { toast.success('Link criado com sucesso!'); resetForm(); setOpen(false); fetchLinks(); }
    setSaving(false);
  };

  const resetForm = () => { setName(''); setUtmSource(''); setUtmMedium(''); setUtmCampaign(''); setUtmTerm(''); setUtmContent(''); };

  const copyToClipboard = (url: string) => { navigator.clipboard.writeText(url); toast.success('Link copiado!'); };

  const deleteLink = async (id: string) => {
    const { error } = await supabase.from('tracking_links' as any).delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Link removido'); fetchLinks(); }
  };

  const downloadQR = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement('a');
      a.download = `qrcode-${qrLink?.name || 'link'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // Totals
  const totals = useMemo(() => {
    let clicks = 0, orders = 0, revenue = 0;
    Object.values(insightsMap).forEach(i => { clicks += i.clicks; orders += i.orders; revenue += i.revenue; });
    return { clicks, orders, revenue, conversion: clicks > 0 ? (orders / clicks) * 100 : 0 };
  }, [insightsMap]);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      {links.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cliques</p>
                  <p className="text-2xl font-bold">{totals.clicks.toLocaleString('pt-BR')}</p>
                </div>
                <Eye className="h-5 w-5 text-info" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pedidos</p>
                  <p className="text-2xl font-bold">{totals.orders}</p>
                </div>
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento</p>
                  <p className="text-2xl font-bold">{fmt(totals.revenue)}</p>
                </div>
                <DollarSign className="h-5 w-5 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversão</p>
                  <p className="text-2xl font-bold">{totals.conversion.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Links de Rastreamento</h2>
          <p className="text-sm text-muted-foreground">
            Crie links personalizados com UTMs para QR Codes, Google Meu Negócio e outros canais de aquisição.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Link
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Link de Rastreamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Nome do Link *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: QR Code Mesa 5, Campanha Black Friday" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fonte (utm_source) *</Label>
                  <Select value={utmSource} onValueChange={setUtmSource}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {sourcePresets.map(s => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Meio (utm_medium)</Label>
                  <Select value={utmMedium} onValueChange={setUtmMedium}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {mediumPresets.map(s => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Campanha (utm_campaign)</Label>
                <Input value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} placeholder="Ex: black-friday-2026" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Termo (utm_term)</Label>
                  <Input value={utmTerm} onChange={e => setUtmTerm(e.target.value)} placeholder="Ex: pizza-margherita" />
                </div>
                <div>
                  <Label>Conteúdo (utm_content)</Label>
                  <Input value={utmContent} onChange={e => setUtmContent(e.target.value)} placeholder="Ex: banner-topo" />
                </div>
              </div>
              <div className="rounded-lg bg-muted p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Preview do Link:</p>
                <p className="text-xs break-all font-mono text-foreground">{previewUrl}</p>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Salvando...' : 'Criar Link'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Links Table */}
      {loading ? (
        <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
      ) : links.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum link criado</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Crie links com parâmetros UTM para rastrear a origem de cada cliente no seu cardápio digital.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map(link => {
                    const ins = insightsMap[link.id] || { clicks: 0, orders: 0, revenue: 0, conversion: 0 };
                    return (
                      <TableRow key={link.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{link.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{link.full_url}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{link.utm_source || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{link.utm_campaign || '-'}</TableCell>
                        <TableCell className="text-right font-semibold">{ins.clicks}</TableCell>
                        <TableCell className="text-right font-semibold">{ins.orders}</TableCell>
                        <TableCell className="text-right">
                          <span className={ins.conversion > 0 ? 'text-success font-semibold' : 'text-muted-foreground'}>
                            {ins.conversion.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">{fmt(ins.revenue)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(link.full_url)} title="Copiar link">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQrLink(link)} title="QR Code">
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(link.full_url, '_blank')} title="Abrir link">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteLink(link.id)} title="Remover">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Dialog */}
      <Dialog open={!!qrLink} onOpenChange={() => setQrLink(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>QR Code - {qrLink?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrLink && (
              <QRCodeSVG
                id="qr-code-svg"
                value={qrLink.full_url}
                size={256}
                level="H"
                includeMargin
                bgColor="hsl(var(--background))"
                fgColor="hsl(var(--foreground))"
              />
            )}
            <p className="text-xs text-muted-foreground break-all">{qrLink?.full_url}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => qrLink && copyToClipboard(qrLink.full_url)}>
                <Copy className="h-4 w-4 mr-2" /> Copiar Link
              </Button>
              <Button size="sm" onClick={downloadQR}>
                <QrCode className="h-4 w-4 mr-2" /> Baixar QR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
