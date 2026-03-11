import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Copy, QrCode, Trash2, ExternalLink, Link2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface TrackingLink {
  id: string;
  name: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  utm_ad_link: string | null;
  full_url: string;
  clicks: number;
  is_active: boolean;
  created_at: string;
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
    const { data } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single();
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
    setLinks((data as any[] || []) as TrackingLink[]);
    setLoading(false);
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
    if (!tenantId || !name.trim()) {
      toast.error('Dê um nome para o link');
      return;
    }
    if (!utmSource) {
      toast.error('Selecione a fonte (UTM Source)');
      return;
    }
    setSaving(true);
    const fullUrl = buildUrl();

    const { error } = await supabase
      .from('tracking_links' as any)
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        utm_term: utmTerm || null,
        utm_content: utmContent || null,
        full_url: fullUrl,
      } as any);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Link criado com sucesso!');
      resetForm();
      setOpen(false);
      fetchLinks();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setName('');
    setUtmSource('');
    setUtmMedium('');
    setUtmCampaign('');
    setUtmTerm('');
    setUtmContent('');
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const deleteLink = async (id: string) => {
    const { error } = await supabase.from('tracking_links' as any).delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Link removido');
      fetchLinks();
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Links de Rastreamento</h2>
          <p className="text-sm text-muted-foreground">
            Crie links personalizados com UTMs para campanhas, QR Codes, Google Meu Negócio e mais.
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
                      {sourcePresets.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Meio (utm_medium)</Label>
                  <Select value={utmMedium} onValueChange={setUtmMedium}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {mediumPresets.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
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

              {/* Preview */}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Meio</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map(link => (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{link.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{link.full_url}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{link.utm_source || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{link.utm_medium || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{link.utm_campaign || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{link.clicks}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(link.full_url)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQrLink(link)}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(link.full_url, '_blank')}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteLink(link.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                <Copy className="h-4 w-4 mr-2" />
                Copiar Link
              </Button>
              <Button size="sm" onClick={downloadQR}>
                <QrCode className="h-4 w-4 mr-2" />
                Baixar QR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
