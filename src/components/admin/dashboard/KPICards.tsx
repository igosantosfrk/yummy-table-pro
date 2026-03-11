import { motion } from 'framer-motion';
import { DollarSign, ShoppingBag, Target, TrendingUp, BarChart3, Clock, Truck, CheckCircle, XCircle, Percent } from 'lucide-react';
import type { DashboardKPIs } from '@/hooks/useDashboardData';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

interface Props {
  kpis: DashboardKPIs;
}

export default function KPICards({ kpis }: Props) {
  const cards = [
    { label: 'Investimento', value: fmt(kpis.investment), icon: Target, gradient: 'from-violet-500/20 to-purple-600/10', iconColor: 'text-violet-400', borderColor: 'border-violet-500/20' },
    { label: 'Pedidos', value: kpis.orders.toString(), icon: ShoppingBag, gradient: 'from-blue-500/20 to-cyan-600/10', iconColor: 'text-blue-400', borderColor: 'border-blue-500/20' },
    { label: 'Custo/Pedido', value: fmt(kpis.costPerOrder), icon: BarChart3, gradient: 'from-amber-500/20 to-orange-600/10', iconColor: 'text-amber-400', borderColor: 'border-amber-500/20' },
    { label: 'Faturamento', value: fmt(kpis.revenue), icon: DollarSign, gradient: 'from-emerald-500/20 to-green-600/10', iconColor: 'text-emerald-400', borderColor: 'border-emerald-500/20' },
    { label: 'Ticket Médio', value: fmt(kpis.avgTicket), icon: TrendingUp, gradient: 'from-primary/20 to-accent/10', iconColor: 'text-primary', borderColor: 'border-primary/20' },
    { label: 'ROI', value: fmtPct(kpis.roi), icon: Percent, gradient: kpis.roi >= 0 ? 'from-emerald-500/20 to-teal-600/10' : 'from-red-500/20 to-rose-600/10', iconColor: kpis.roi >= 0 ? 'text-emerald-400' : 'text-red-400', borderColor: kpis.roi >= 0 ? 'border-emerald-500/20' : 'border-red-500/20' },
    { label: 'Em Preparo', value: kpis.preparing.toString(), icon: Clock, gradient: 'from-yellow-500/20 to-amber-600/10', iconColor: 'text-yellow-400', borderColor: 'border-yellow-500/20' },
    { label: 'Em Entrega', value: kpis.outForDelivery.toString(), icon: Truck, gradient: 'from-sky-500/20 to-blue-600/10', iconColor: 'text-sky-400', borderColor: 'border-sky-500/20' },
    { label: 'Finalizados', value: kpis.completed.toString(), icon: CheckCircle, gradient: 'from-emerald-500/20 to-green-600/10', iconColor: 'text-emerald-400', borderColor: 'border-emerald-500/20' },
    { label: 'Cancelados', value: kpis.cancelled.toString(), icon: XCircle, gradient: 'from-red-500/20 to-rose-600/10', iconColor: 'text-red-400', borderColor: 'border-red-500/20' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <motion.div key={c.label} variants={item}>
          <div className={`relative overflow-hidden rounded-xl border ${c.borderColor} bg-gradient-to-br ${c.gradient} backdrop-blur-sm p-4 hover:scale-[1.02] transition-transform duration-200 cursor-default group`}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.iconColor} opacity-70 group-hover:opacity-100 transition-opacity`} />
            </div>
            <div className="text-xl font-display font-bold text-foreground">{c.value}</div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
