import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import type { FunnelStep } from '@/hooks/useDashboardData';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(25, 95%, 53%)',
  'hsl(142, 76%, 36%)',
  'hsl(217, 91%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 70%, 55%)',
];

interface Props {
  data: FunnelStep[];
  loading: boolean;
}

export default function FunnelChart({ data, loading }: Props) {
  const maxSessions = data[0]?.sessions || 1;

  return (
    <Card className="glass border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          Funil do Cardápio
          <span className="text-xs font-normal text-muted-foreground ml-1">(sessões únicas)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-3">
            {data.map((step, i) => {
              const pct = (step.sessions / maxSessions) * 100;
              const dropoff = i > 0 ? (((data[i - 1].sessions - step.sessions) / data[i - 1].sessions) * 100) : 0;
              return (
                <div key={step.step}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{step.sessions}</span>
                      {i > 0 && dropoff > 0 && (
                        <span className="text-xs text-red-400">-{dropoff.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                  <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
            {loading ? 'Carregando...' : 'Sem visualizações'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
