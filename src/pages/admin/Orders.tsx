import { useAutoPrint } from "@/hooks/useAutoPrint";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ShoppingBag, LayoutGrid, List, ChefHat, Truck, CheckCircle, XCircle, Clock, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';
import { Order, OrderStatus, statusConfig, kanbanColumns } from '@/components/admin/orders/types';
import OrderCard from '@/components/admin/orders/OrderCard';
import OrderDetailSheet from '@/components/admin/orders/OrderDetailSheet';
import CustomerDetailSheet from '@/components/admin/orders/CustomerDetailSheet';
import OrderListView from '@/components/admin/orders/OrderListView';
import { toast } from '@/hooks/use-toast';

type ViewMode = 'kanban' | 'list';

const columnIcons: Record<string, React.ElementType> = {
  new: Sparkles,
  preparing: ChefHat,
  out_for_delivery: Truck,
  completed: CheckCircle,
  cancelled: XCircle,
};

const Orders = () => {
  const { tenantId } = useAuth();
  useAutoPrint(tenantId);
  const { preset, setPreset, dateRange, customRange, setCustomRange } = useDateRange('today');
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerOrder, setCustomerOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const orderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const playNewOrderSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      playTone(880, 0, 0.15);
      playTone(1100, 0.15, 0.15);
      playTone(1320, 0.3, 0.25);
    } catch (e) { console.warn("Audio not available:", e); }
  }, [soundEnabled]);

  const fetchOrders = useCallback(async () => {
    if (!tenantId || isDragging) return; // Don't fetch while dragging
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: true });
      const fetched = (data || []) as Order[];
      setOrders(fetched);

      // Detect new orders and play sound
      if (initialLoadRef.current) {
        orderIdsRef.current = new Set(fetched.map(o => o.id));
        initialLoadRef.current = false;
      } else {
        const newOrders = fetched.filter(o => o.status === 'new' && !orderIdsRef.current.has(o.id));
        if (newOrders.length > 0) {
          playNewOrderSound();
          toast({ title: 'Novo pedido!', description: 'Pedido #' + newOrders[newOrders.length - 1].order_number });
        }
        orderIdsRef.current = new Set(fetched.map(o => o.id));
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  }, [tenantId, dateRange.from, dateRange.to, isDragging, playNewOrderSound]);

  useEffect(() => {
    fetchOrders();
    
    // Realtime subscription - pause during drag
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        if (!isDragging) {
          fetchOrders();
        }
      })
      .subscribe();
    
    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [tenantId, dateRange.from, dateRange.to, isDragging, fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'completed') updateData.delivered_at = new Date().toISOString();
      if (newStatus === 'cancelled') updateData.cancelled_at = new Date().toISOString();
      
      await supabase.from('orders').update(updateData).eq('id', orderId);
      await fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = useCallback((result: DropResult) => {
    setIsDragging(false);
    
    const { draggableId, destination } = result;
    if (!destination) return;
    
    const newStatus = destination.droppableId as OrderStatus;
    const order = orders.find(o => o.id === draggableId);
    if (!order || order.status === newStatus) return;
    
    // Optimistic update
    setOrders(prev => prev.map(o => 
      o.id === draggableId ? { ...o, status: newStatus } : o
    ));
    
    // Update in database
    updateStatus(draggableId, newStatus);
  }, [orders]);

  const openDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const openCustomer = (order: Order) => {
    setCustomerOrder(order);
    setDetailOpen(false);
    setCustomerOpen(true);
  };

  // Status summary
  const counts = {
    all: orders.length,
    new: orders.filter(o => o.status === 'new').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground">{orders.length} pedidos no período</p>
        </motion.div>
        <div className="flex items-center gap-3">
          {/* Sound Toggle */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Desativar som" : "Ativar som"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>
          {/* View Toggle */}
          <div className="flex items-center bg-muted/30 rounded-lg p-0.5 border border-border/20">
            <Button
              size="sm"
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              className={`h-7 px-2.5 text-xs ${viewMode === 'kanban' ? 'gradient-primary shadow-sm text-primary-foreground' : 'text-foreground/75 hover:text-foreground'}`}
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Kanban
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className={`h-7 px-2.5 text-xs ${viewMode === 'list' ? 'gradient-primary shadow-sm text-primary-foreground' : 'text-foreground/75 hover:text-foreground'}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5 mr-1" />
              Lista
            </Button>
          </div>
          <DateRangeFilter
            preset={preset}
            onPresetChange={setPreset}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
          />
        </div>
      </div>

      {/* Status Summary Bar */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'all' as const, label: 'Todos', icon: ShoppingBag, count: counts.all },
          { key: 'new' as const, label: 'Novos', icon: Sparkles, count: counts.new },
          { key: 'preparing' as const, label: 'Em Preparo', icon: ChefHat, count: counts.preparing },
          { key: 'out_for_delivery' as const, label: 'Em Entrega', icon: Truck, count: counts.out_for_delivery },
          { key: 'completed' as const, label: 'Finalizados', icon: CheckCircle, count: counts.completed },
          { key: 'cancelled' as const, label: 'Cancelados', icon: XCircle, count: counts.cancelled },
        ]).map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              statusFilter === s.key
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/10 border-border/20 text-muted-foreground hover:bg-muted/30'
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
            <Badge variant="secondary" className="h-5 min-w-[20px] justify-center text-[10px] px-1.5 bg-background/50">
              {s.count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Content */}
      {orders.length === 0 ? (
        <Card className="glass border-border/30">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-display font-semibold text-muted-foreground">Nenhum pedido no período</p>
            <p className="text-sm text-muted-foreground mt-1">Os pedidos aparecerão aqui em tempo real</p>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {kanbanColumns.map(status => {
              const config = statusConfig[status];
              const Icon = columnIcons[status] || Clock;
              const columnOrders = (statusFilter === 'all' || statusFilter === status)
                ? orders.filter(o => o.status === status)
                : [];
              return (
                <div key={status} className="space-y-3">
                  {/* Column Header */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${config.bgClass}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className={`font-semibold text-sm ${config.color}`}>{config.label}</span>
                    <Badge variant="secondary" className="ml-auto h-5 min-w-[20px] justify-center text-[10px] bg-background/50">
                      {columnOrders.length}
                    </Badge>
                  </div>
                  {/* Droppable Column */}
                  <Droppable droppableId={status}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-2 min-h-[100px] rounded-xl p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}
                      >
                        {columnOrders.map((order, i) => (
                          <Draggable key={order.id} draggableId={order.id} index={i}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`${dragSnapshot.isDragging ? 'opacity-90 rotate-1 scale-105' : ''} transition-transform`}
                              >
                                <OrderCard
                                  order={order}
                                  index={0}
                                  onStatusChange={updateStatus}
                                  onOpenDetail={openDetail}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {columnOrders.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground border border-dashed border-border/20 rounded-xl">
                            Nenhum pedido
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        <Card className="glass border-border/30">
          <CardContent className="p-0">
            <OrderListView
              orders={filteredOrders}
              onStatusChange={updateStatus}
              onOpenDetail={openDetail}
            />
          </CardContent>
        </Card>
      )}

      {/* Sheets */}
      <OrderDetailSheet
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChange={updateStatus}
        onOpenCustomer={openCustomer}
      />
      <CustomerDetailSheet
        order={customerOrder}
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        tenantId={tenantId}
      />
    </div>
  );
};

export default Orders;
