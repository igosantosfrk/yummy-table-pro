import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, CreditCard } from 'lucide-react';
import { Order, OrderStatus, statusConfig, paymentMethodLabels, getTimeAgo } from './types';

interface Props {
  order: Order;
  index: number;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onOpenDetail: (order: Order) => void;
}

export default function OrderCard({ order, index, onStatusChange, onOpenDetail }: Props) {
  const config = statusConfig[order.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      layout
    >
      <Card
        className={`border ${config.bgClass} backdrop-blur-sm hover:scale-[1.01] transition-all duration-200 cursor-pointer group`}
        onClick={() => onOpenDetail(order)}
      >
        <CardContent className="p-3.5 space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-primary text-sm">#{order.order_number}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-border/30">
                {paymentMethodLabels[order.payment_method]}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {getTimeAgo(order.created_at)}
            </span>
          </div>

          {/* Customer */}
          <div>
            <p className="font-semibold text-sm truncate">{order.customer_name}</p>
            {order.delivery_neighborhood && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{order.delivery_neighborhood}</span>
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-border/20">
            <span className="font-display font-bold text-foreground text-sm">
              R$ {Number(order.total).toFixed(2).replace('.', ',')}
            </span>
            <div className="flex items-center gap-1">
              <CreditCard className={`h-3 w-3 ${order.payment_status === 'confirmed' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            {order.status === 'new' && (
              <Button size="sm" className="w-full text-[11px] h-7 gradient-primary" onClick={() => onStatusChange(order.id, 'preparing')}>
                Aceitar Pedido
              </Button>
            )}
            {order.status === 'preparing' && (
              <Button size="sm" className="w-full text-[11px] h-7 gradient-primary" onClick={() => onStatusChange(order.id, 'out_for_delivery')}>
                Saiu p/ Entrega
              </Button>
            )}
            {order.status === 'out_for_delivery' && (
              <Button size="sm" className="w-full text-[11px] h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => onStatusChange(order.id, 'completed')}>
                Entregue ✓
              </Button>
            )}
            {(order.status === 'new' || order.status === 'preparing' || order.status === 'out_for_delivery') && (
              <Button size="sm" variant="ghost" className="text-[11px] h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2" onClick={() => onStatusChange(order.id, 'cancelled')}>
                ✕
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
