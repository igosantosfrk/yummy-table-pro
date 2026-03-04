import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Plus, Building2, Users, ShoppingBag, DollarSign, ArrowLeft
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type TenantStatus = Database['public']['Enums']['tenant_status'];

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: string | null;
  created_at: string;
  email: string | null;
  phone: string | null;
}

const statusColors: Record<TenantStatus, string> = {
  active: 'bg-success text-success-foreground',
  suspended: 'bg-destructive text-destructive-foreground',
  trial: 'bg-warning text-warning-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};

const SuperAdmin = () => {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', email: '', phone: '' });

  const fetchTenants = async () => {
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    setTenants(data || []);
  };

  useEffect(() => {
    if (!isSuperAdmin) { navigate('/admin'); return; }
    fetchTenants();
  }, [isSuperAdmin]);

  const handleCreate = async () => {
    if (!form.name || !form.slug) {
      toast({ title: 'Preencha nome e slug', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('tenants').insert({
      name: form.name, slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      email: form.email || null, phone: form.phone || null,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Licença criada!' });
    setDialogOpen(false);
    setForm({ name: '', slug: '', email: '', phone: '' });
    fetchTenants();
  };

  const updateStatus = async (id: string, status: TenantStatus) => {
    await supabase.from('tenants').update({ status }).eq('id', id);
    fetchTenants();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
          <Shield className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Super Admin</h1>
          <p className="text-muted-foreground text-sm">Gerenciamento da plataforma</p>
        </div>
      </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Licenças', value: tenants.length, icon: Building2, color: 'text-primary' },
            { label: 'Ativas', value: tenants.filter(t => t.status === 'active').length, icon: Users, color: 'text-success' },
            { label: 'Em Trial', value: tenants.filter(t => t.status === 'trial').length, icon: ShoppingBag, color: 'text-warning' },
            { label: 'Receita', value: 'R$ 0', icon: DollarSign, color: 'text-primary' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="glass">
                <CardContent className="p-4 flex items-center gap-4">
                  <s.icon className={`h-8 w-8 ${s.color}`} />
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-display font-bold">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tenants table */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Licenças</CardTitle>
            <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-white">
              <Plus className="h-4 w-4 mr-2" /> Nova Licença
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">/{t.slug}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[t.status]}>{t.status}</Badge>
                    </TableCell>
                    <TableCell>{t.plan || 'free'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Select onValueChange={(v) => updateStatus(t.id, v as TenantStatus)}>
                        <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativar</SelectItem>
                          <SelectItem value="suspended">Suspender</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="cancelled">Cancelar</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Nova Licença</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Restaurante *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Pizzaria da Vila" />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL) *</Label>
                <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="pizzaria-da-vila" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full gradient-primary text-white">Criar Licença</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default SuperAdmin;
