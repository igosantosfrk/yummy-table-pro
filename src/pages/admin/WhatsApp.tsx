import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Send, CheckCheck, XCircle } from 'lucide-react';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';

const WhatsApp = () => {
  const { tenantId } = useAuth();
  const { preset, setPreset, dateRange, customRange, setCustomRange } = useDateRange('today');
  const [instance, setInstance] = useState<any>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      const { data: inst } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      setInstance(inst);

      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
      setOrderCount(count || 0);
      setLoading(false);
    };
    load();
  }, [tenantId, dateRange.from.getTime(), dateRange.to.getTime()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-display font-bold">WhatsApp</h1>
        <DateRangeFilter
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-lg font-bold">
                  {instance?.is_connected ? (
                    <Badge className="bg-success/20 text-success border-0">Conectado</Badge>
                  ) : (
                    <Badge variant="secondary">Desconectado</Badge>
                  )}
                </p>
              </div>
              <MessageSquare className="h-5 w-5 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pedidos no Período</p>
                <p className="text-2xl font-bold">{orderCount}</p>
              </div>
              <Send className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Confirmação Auto</p>
                <p className="text-lg font-bold">
                  {instance?.auto_send_confirmation ? (
                    <CheckCheck className="h-5 w-5 text-success" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="text-sm font-bold">{instance?.phone_number || 'Não configurado'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!instance && (
        <Card className="glass border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Configure sua integração WhatsApp</p>
            <p className="text-sm text-muted-foreground">Acesse as configurações para conectar sua instância</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WhatsApp;
