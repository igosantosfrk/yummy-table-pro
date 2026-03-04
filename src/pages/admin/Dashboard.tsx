import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ShoppingBag, DollarSign, Clock, TrendingUp, CheckCircle, XCircle, Truck, Package } from 'lucide-react';

const stats = [
  { label: 'Pedidos Hoje', value: '0', icon: ShoppingBag, color: 'text-primary' },
  { label: 'Faturamento', value: 'R$ 0,00', icon: DollarSign, color: 'text-success' },
  { label: 'Em Preparo', value: '0', icon: Clock, color: 'text-warning' },
  { label: 'Em Entrega', value: '0', icon: Truck, color: 'text-info' },
  { label: 'Finalizados', value: '0', icon: CheckCircle, color: 'text-success' },
  { label: 'Cancelados', value: '0', icon: XCircle, color: 'text-destructive' },
  { label: 'Ticket Médio', value: 'R$ 0,00', icon: TrendingUp, color: 'text-primary' },
  { label: 'Produtos Ativos', value: '0', icon: Package, color: 'text-accent' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const Dashboard = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Olá, {profile?.full_name?.split(' ')[0] || 'Admin'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Aqui está o resumo do seu restaurante hoje.
        </p>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card className="glass hover:shadow-glow-sm transition-all duration-300 cursor-default">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Placeholder for charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-display">Vendas da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Gráfico será exibido quando houver dados
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-display">Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Dados serão exibidos quando houver pedidos
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
