import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Sparkles } from 'lucide-react';
import type { AdSale } from '@/hooks/useDashboardData';

interface Props {
  data: AdSale[];
  loading: boolean;
}

export default function AdSalesTable({ data, loading }: Props) {
  return (
    <Card className="glass border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Vendas por Anúncio
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-2.5 px-2 text-muted-foreground font-medium text-xs uppercase tracking-wider">Fonte</th>
                  <th className="text-left py-2.5 px-2 text-muted-foreground font-medium text-xs uppercase tracking-wider">Campanha</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium text-xs uppercase tracking-wider">Views</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium text-xs uppercase tracking-wider">Pedidos</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium text-xs uppercase tracking-wider">Receita</th>
                  <th className="text-center py-2.5 px-2 text-muted-foreground font-medium text-xs uppercase tracking-wider">Link</th>
                </tr>
              </thead>
              <tbody>
                {data.map((ad, i) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {ad.source || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-sm truncate max-w-[180px]">{ad.campaign || '—'}</td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground">{ad.views}</td>
                    <td className="py-2.5 px-2 text-right font-semibold">{ad.orders}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-emerald-400">
                      R$ {ad.revenue.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {ad.adLink ? (
                        <a href={ad.adLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:text-accent transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            {loading ? 'Carregando...' : 'Sem dados de anúncios'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
