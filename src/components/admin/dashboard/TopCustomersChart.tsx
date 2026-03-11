import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown } from 'lucide-react';
import type { TopCustomer } from '@/hooks/useDashboardData';

interface Props {
  data: TopCustomer[];
  loading: boolean;
}

const medals = ['🥇', '🥈', '🥉'];

export default function TopCustomersChart({ data, loading }: Props) {
  return (
    <Card className="glass border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-400" />
          Ranking de Clientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-2">
            {data.map((c, i) => (
              <div key={c.phone} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                <span className="text-lg w-7 text-center shrink-0">
                  {i < 3 ? medals[i] : <span className="text-xs text-muted-foreground font-bold">{i + 1}º</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.orders} pedido{c.orders > 1 ? 's' : ''}</p>
                </div>
                <span className="text-sm font-bold text-emerald-400 shrink-0">
                  R$ {c.total.toFixed(2).replace('.', ',')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
            {loading ? 'Carregando...' : 'Sem clientes'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
