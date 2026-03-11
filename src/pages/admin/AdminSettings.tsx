import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Settings, Save, CreditCard } from 'lucide-react';

const AdminSettings = () => {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', slug: '', description: '', phone: '', email: '',
    address: '', city: '', state: '', zip_code: '',
    logo_url: '', banner_url: '', is_open: true,
    delivery_fee: '0', min_order_value: '0', avg_delivery_time_min: '45',
    stripe_secret_key: '', stripe_publishable_key: '',
  });

  useEffect(() => {
    if (!tenantId) return;
    supabase.from('tenants').select('*').eq('id', tenantId).single().then(({ data }) => {
      if (data) {
        setForm({
          name: data.name || '',
          slug: data.slug || '',
          description: data.description || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zip_code: data.zip_code || '',
          logo_url: data.logo_url || '',
          banner_url: data.banner_url || '',
          is_open: data.is_open ?? true,
          delivery_fee: String(data.delivery_fee || 0),
          min_order_value: String(data.min_order_value || 0),
          avg_delivery_time_min: String(data.avg_delivery_time_min || 45),
          stripe_secret_key: data.stripe_secret_key || '',
          stripe_publishable_key: data.stripe_publishable_key || '',
        });
      }
    });
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { error } = await supabase.from('tenants').update({
      name: form.name, description: form.description || null,
      phone: form.phone || null, email: form.email || null,
      address: form.address || null, city: form.city || null,
      state: form.state || null, zip_code: form.zip_code || null,
      logo_url: form.logo_url || null, banner_url: form.banner_url || null,
      is_open: form.is_open,
      delivery_fee: parseFloat(form.delivery_fee) || 0,
      min_order_value: parseFloat(form.min_order_value) || 0,
      avg_delivery_time_min: parseInt(form.avg_delivery_time_min) || 45,
    }).eq('id', tenantId);
    setLoading(false);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Configurações salvas!' });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-display font-bold">Configurações</h1>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Settings className="h-5 w-5" /> Dados do Restaurante
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Restaurante</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input value={form.slug} disabled className="bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle className="font-display">Imagens</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Logo</Label>
            <Input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>URL do Banner</Label>
            <Input value={form.banner_url} onChange={e => setForm({ ...form, banner_url: e.target.value })} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle className="font-display">Delivery</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Switch checked={form.is_open} onCheckedChange={v => setForm({ ...form, is_open: v })} />
            <Label>Restaurante {form.is_open ? 'Aberto' : 'Fechado'}</Label>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Taxa de Entrega (R$)</Label>
              <Input type="number" value={form.delivery_fee} onChange={e => setForm({ ...form, delivery_fee: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Pedido Mínimo (R$)</Label>
              <Input type="number" value={form.min_order_value} onChange={e => setForm({ ...form, min_order_value: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tempo Entrega (min)</Label>
              <Input type="number" value={form.avg_delivery_time_min} onChange={e => setForm({ ...form, avg_delivery_time_min: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading} className="gradient-primary text-white" size="lg">
        <Save className="h-4 w-4 mr-2" /> Salvar Configurações
      </Button>
    </div>
  );
};

export default AdminSettings;
