import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ShoppingBag, Clock, Truck, CheckCircle, XCircle, ChefHat } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  delivery_address: string | null;
  notes: string | null;
}

const statusConfig: Record<OrderStatus, { label: string; icon: React.ElementType; color: string }> = {
  new: { label: 'Novo', icon: ShoppingBag, color: 'bg-info text-info-foreground' },
  preparing: { label: 'Em Preparo', icon: ChefHat, color: 'bg-warning text-warning-foreground' },
  out_for_delivery: { label: 'Saiu p/ Entrega', icon: Truck, color: 'bg-primary text-primary-foreground' },
  completed: { label: 'Finalizado', icon: CheckCircle, color: 'bg-success text-success-foreground' },
  cancelled: { label: 'Cancelado', icon: XCircle, color: 'bg-destructive text-destructive-foreground' },
};

const columns: OrderStatus[] = ['new', 'preparing', 'out_for_delivery', 'completed'];

const Orders = () => {
  const { tenantId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    setOrders(data || []);
  };

  useEffect(() => {
    fetchOrders();

    // Realtime subscription
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    fetchOrders();
  };

  const getTimeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h${mins % 60}min`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Pedidos</h1>
        <p className="text-muted-foreground">{orders.length} pedidos total</p>
      </div>

      {orders.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum pedido ainda</p>
            <p className="text-sm text-muted-foreground">Os pedidos aparecerão aqui em tempo real</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-4 gap-4">
          {columns.map(status => {
            const config = statusConfig[status];
            const columnOrders = orders.filter(o => o.status === status);
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <config.icon className="h-4 w-4" />
                  <span className="font-semibold text-sm">{config.label}</span>
                  <Badge variant="secondary" className="ml-auto">{columnOrders.length}</Badge>
                </div>
                <div className="space-y-2">
                  {columnOrders.map((order, i) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="glass hover:shadow-glow-sm transition-all">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-display font-bold text-primary">#{order.order_number}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {getTimeAgo(order.created_at)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground">
                              R$ {order.total.toFixed(2)}
                            </span>
                            <Badge variant="outline" className="text-xs">{order.payment_method}</Badge>
                          </div>
                          {/* Status actions */}
                          <div className="flex gap-1">
                            {status === 'new' && (
                              <Button size="sm" className="w-full text-xs" onClick={() => updateStatus(order.id, 'preparing')}>
                                Preparar
                              </Button>
                            )}
                            {status === 'preparing' && (
                              <Button size="sm" className="w-full text-xs" onClick={() => updateStatus(order.id, 'out_for_delivery')}>
                                Saiu p/ Entrega
                              </Button>
                            )}
                            {status === 'out_for_delivery' && (
                              <Button size="sm" className="w-full text-xs" onClick={() => updateStatus(order.id, 'completed')}>
                                Finalizar
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Orders;
