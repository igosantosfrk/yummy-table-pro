import type { Database } from '@/integrations/supabase/types';

export type OrderStatus = Database['public']['Enums']['order_status'];
export type PaymentMethod = Database['public']['Enums']['payment_method'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];

export interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string | null;
  addons: any;
}

export interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  status: OrderStatus;
  total: number;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  created_at: string;
  delivery_address: string | null;
  delivery_neighborhood: string | null;
  delivery_city: string | null;
  delivery_notes: string | null;
  notes: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_ad_link: string | null;
  session_id: string | null;
  stripe_payment_intent_id: string | null;
}

export const statusConfig: Record<OrderStatus, { label: string; color: string; bgClass: string }> = {
  new: { label: 'Novo', color: 'text-sky-400', bgClass: 'bg-sky-500/10 border-sky-500/20' },
  preparing: { label: 'Em Preparo', color: 'text-amber-400', bgClass: 'bg-amber-500/10 border-amber-500/20' },
  out_for_delivery: { label: 'Em Entrega', color: 'text-blue-400', bgClass: 'bg-blue-500/10 border-blue-500/20' },
  completed: { label: 'Finalizado', color: 'text-emerald-400', bgClass: 'bg-emerald-500/10 border-emerald-500/20' },
  cancelled: { label: 'Cancelado', color: 'text-red-400', bgClass: 'bg-red-500/10 border-red-500/20' },
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  pix: 'PIX',
  credit_card: 'Cartão Crédito',
  debit_card: 'Cartão Débito',
  cash: 'Dinheiro',
  online: 'Online',
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  failed: 'Falhou',
  refunded: 'Reembolsado',
};

export const kanbanColumns: OrderStatus[] = ['preparing', 'out_for_delivery', 'completed'];

export function getTimeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h${mins % 60}min`;
  return `${Math.floor(hours / 24)}d`;
}
