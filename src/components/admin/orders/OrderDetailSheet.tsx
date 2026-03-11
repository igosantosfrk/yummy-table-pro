import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Clock, MapPin, Phone, Mail, CreditCard, ExternalLink, User, Package, Truck, Hash, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, OrderStatus, statusConfig, paymentMethodLabels, paymentStatusLabels, getTimeAgo } from './types';

interface Props {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onOpenCustomer: (order: Order) => void;
}

export default function OrderDetailSheet({ order, open, onOpenChange, onStatusChange, onOpenCustomer }: Props) {
  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (!order) return;
    supabase
      .from('order_items')
      .select('id, product_name, quantity, unit_price, total, notes, addons')
      .eq('order_id', order.id)
      .then(({ data }) => setItems(data || []));
  }, [order?.id]);

  if (!order) return null;
  const config = statusConfig[order.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card border-border/30">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-xl flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              Pedido #{order.order_number}
            </SheetTitle>
            <Badge className={`${config.bgClass} ${config.color} border text-xs`}>
              {config.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(order.created_at).toLocaleString('pt-BR')} · {getTimeAgo(order.created_at)} atrás
          </p>
        </SheetHeader>

        <div className="space-y-5 mt-2">
          {/* Customer Section */}
          <div
            className="p-3 rounded-xl bg-muted/20 border border-border/20 cursor-pointer hover:bg-muted/40 transition-colors group"
            onClick={() => onOpenCustomer(order)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</span>
              <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">Ver perfil →</span>
            </div>
            <div className="space-y-1">
              <p className="font-semibold flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {order.customer_name}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" />
                {order.customer_phone}
              </p>
              {order.customer_email && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  {order.customer_email}
                </p>
              )}
            </div>
          </div>

          {/* Items */}
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Package className="h-3.5 w-3.5" />
              Itens do Pedido
            </span>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-start justify-between py-2 px-3 rounded-lg bg-muted/10 border border-border/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.quantity}x {item.product_name}</p>
                    {item.notes && <p className="text-[11px] text-muted-foreground mt-0.5">📝 {item.notes}</p>}
                    {item.addons && Array.isArray(item.addons) && item.addons.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        + {(item.addons as any[]).map((a: any) => a.name || a).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold shrink-0 ml-2">
                    R$ {Number(item.total).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border/20 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R$ {Number(order.subtotal).toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa de entrega</span>
              <span>R$ {Number(order.delivery_fee).toFixed(2).replace('.', ',')}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Desconto</span>
                <span className="text-emerald-400">-R$ {Number(order.discount).toFixed(2).replace('.', ',')}</span>
              </div>
            )}
            <Separator className="bg-border/20" />
            <div className="flex justify-between font-display font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">R$ {Number(order.total).toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <CreditCard className="h-3.5 w-3.5" />
              Pagamento
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{paymentMethodLabels[order.payment_method]}</Badge>
              <Badge className={`text-xs ${order.payment_status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'} border`}>
                {paymentStatusLabels[order.payment_status]}
              </Badge>
            </div>
            {order.stripe_payment_intent_id && (
              <p className="text-[11px] text-muted-foreground mt-2 font-mono">ID: {order.stripe_payment_intent_id}</p>
            )}
          </div>

          {/* Delivery */}
          {order.delivery_address && (
            <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Truck className="h-3.5 w-3.5" />
                Entrega
              </span>
              <p className="text-sm">{order.delivery_address}</p>
              {order.delivery_neighborhood && <p className="text-sm text-muted-foreground">{order.delivery_neighborhood}{order.delivery_city ? ` - ${order.delivery_city}` : ''}</p>}
              {order.delivery_notes && <p className="text-[11px] text-muted-foreground mt-1">📝 {order.delivery_notes}</p>}
            </div>
          )}

          {/* Tracking */}
          {(order.utm_source || order.utm_campaign) && (
            <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Globe className="h-3.5 w-3.5" />
                Rastreamento
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {order.utm_source && (
                  <div><span className="text-muted-foreground">Fonte:</span> <span className="font-medium">{order.utm_source}</span></div>
                )}
                {order.utm_campaign && (
                  <div><span className="text-muted-foreground">Campanha:</span> <span className="font-medium">{order.utm_campaign}</span></div>
                )}
                {order.utm_medium && (
                  <div><span className="text-muted-foreground">Mídia:</span> <span className="font-medium">{order.utm_medium}</span></div>
                )}
                {order.utm_ad_link && (
                  <div>
                    <a href={order.utm_ad_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-accent flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Ver anúncio
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {order.notes && (
            <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Observações</span>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}

          {/* Status Actions */}
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <div className="flex gap-2 pt-2">
              {order.status === 'preparing' && (
                <Button className="flex-1 gradient-primary" onClick={() => { onStatusChange(order.id, 'out_for_delivery'); onOpenChange(false); }}>
                  <Truck className="h-4 w-4 mr-2" />
                  Saiu p/ Entrega
                </Button>
              )}
              {order.status === 'out_for_delivery' && (
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => { onStatusChange(order.id, 'completed'); onOpenChange(false); }}>
                  Marcar como Entregue ✓
                </Button>
              )}
              <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => { onStatusChange(order.id, 'cancelled'); onOpenChange(false); }}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
