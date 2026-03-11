import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { User, Phone, Mail, MapPin, ShoppingBag, DollarSign, Calendar, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Order } from './types';
import { toast } from 'sonner';

interface CustomerHistory {
  id: string;
  order_number: number;
  total: number;
  status: string;
  created_at: string;
}

interface Props {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
}

export default function CustomerDetailSheet({ order, open, onOpenChange, tenantId }: Props) {
  const [history, setHistory] = useState<CustomerHistory[]>([]);
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!order || !tenantId || !open) return;
    setEmail(order.customer_email || '');
    setNotes('');

    // Fetch all orders from this customer
    supabase
      .from('orders')
      .select('id, order_number, total, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', order.customer_phone)
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistory(data || []));
  }, [order?.customer_phone, tenantId, open]);

  if (!order) return null;

  const totalSpent = history.filter(h => h.status !== 'cancelled').reduce((s, h) => s + Number(h.total), 0);
  const totalOrders = history.length;
  const avgTicket = totalOrders > 0 ? totalSpent / history.filter(h => h.status !== 'cancelled').length : 0;
  const firstOrder = history.length > 0 ? history[history.length - 1].created_at : order.created_at;

  const handleSaveNotes = async () => {
    if (!order) return;
    setLoading(true);
    // Update email on the latest order if changed
    if (email !== (order.customer_email || '')) {
      await supabase.from('orders').update({ customer_email: email }).eq('id', order.id);
    }
    toast.success('Informações atualizadas');
    setLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border/30">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Perfil do Cliente
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-2">
          {/* Customer Info */}
          <div className="text-center p-5 rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/10">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg">{order.customer_name}</h3>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
              <Phone className="h-3.5 w-3.5" />
              {order.customer_phone}
            </p>
            {order.customer_email && (
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-0.5">
                <Mail className="h-3.5 w-3.5" />
                {order.customer_email}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
              <ShoppingBag className="h-4 w-4 text-blue-400 mx-auto mb-1" />
              <p className="font-display font-bold text-lg">{totalOrders}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Pedidos</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
              <DollarSign className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
              <p className="font-display font-bold text-sm">R$ {totalSpent.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Total Gasto</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/20 border border-border/20">
              <Calendar className="h-4 w-4 text-purple-400 mx-auto mb-1" />
              <p className="font-display font-bold text-sm">{new Date(firstOrder).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Desde</p>
            </div>
          </div>

          <Separator className="bg-border/20" />

          {/* Editable Fields */}
          <div className="space-y-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Informações Adicionais</span>
            <div>
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="mt-1 bg-muted/20 border-border/20"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Observações internas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre este cliente..."
                className="mt-1 bg-muted/20 border-border/20 min-h-[80px]"
              />
            </div>
            <Button className="w-full gradient-primary" onClick={handleSaveNotes} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Informações
            </Button>
          </div>

          <Separator className="bg-border/20" />

          {/* Order History */}
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
              Histórico de Pedidos ({totalOrders})
            </span>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/10 border border-border/10 hover:bg-muted/20 transition-colors">
                  <div>
                    <span className="text-sm font-semibold text-primary">#{h.order_number}</span>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">R$ {Number(h.total).toFixed(2).replace('.', ',')}</span>
                    <p className="text-[10px] text-muted-foreground capitalize">{h.status === 'completed' ? '✅' : h.status === 'cancelled' ? '❌' : '⏳'} {h.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Address */}
          {order.delivery_address && (
            <>
              <Separator className="bg-border/20" />
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <MapPin className="h-3.5 w-3.5" />
                  Último Endereço
                </span>
                <p className="text-sm">{order.delivery_address}</p>
                {order.delivery_neighborhood && <p className="text-sm text-muted-foreground">{order.delivery_neighborhood}</p>}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
