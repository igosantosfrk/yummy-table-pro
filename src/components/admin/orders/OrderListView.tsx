import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin } from 'lucide-react';
import { Order, OrderStatus, statusConfig, paymentMethodLabels, getTimeAgo } from './types';

interface Props {
  orders: Order[];
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onOpenDetail: (order: Order) => void;
}

export default function OrderListView({ orders, onStatusChange, onOpenDetail }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30">
            <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">#</th>
            <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Cliente</th>
            <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden md:table-cell">Bairro</th>
            <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Status</th>
            <th className="text-left py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Pagamento</th>
            <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Total</th>
            <th className="text-right py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Tempo</th>
            <th className="text-center py-3 px-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Ação</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => {
            const config = statusConfig[order.status];
            return (
              <tr
                key={order.id}
                className="border-b border-border/10 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => onOpenDetail(order)}
              >
                <td className="py-3 px-3">
                  <span className="font-display font-bold text-primary">#{order.order_number}</span>
                </td>
                <td className="py-3 px-3">
                  <p className="font-semibold truncate max-w-[140px]">{order.customer_name}</p>
                  <p className="text-[11px] text-muted-foreground">{order.customer_phone}</p>
                </td>
                <td className="py-3 px-3 hidden md:table-cell">
                  {order.delivery_neighborhood ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {order.delivery_neighborhood}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-3 px-3">
                  <Badge className={`${config.bgClass} ${config.color} border text-[10px]`}>
                    {config.label}
                  </Badge>
                </td>
                <td className="py-3 px-3 hidden sm:table-cell">
                  <Badge variant="outline" className="text-[10px]">{paymentMethodLabels[order.payment_method]}</Badge>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="font-bold">R$ {Number(order.total).toFixed(2).replace('.', ',')}</span>
                </td>
                <td className="py-3 px-3 text-right hidden sm:table-cell">
                  <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" />
                    {getTimeAgo(order.created_at)}
                  </span>
                </td>
                <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                  {order.status === 'preparing' && (
                    <Button size="sm" className="text-[10px] h-6 px-2 gradient-primary" onClick={() => onStatusChange(order.id, 'out_for_delivery')}>
                      Entregar
                    </Button>
                  )}
                  {order.status === 'out_for_delivery' && (
                    <Button size="sm" className="text-[10px] h-6 px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => onStatusChange(order.id, 'completed')}>
                      Entregue
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
