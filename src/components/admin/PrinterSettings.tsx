import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { qzTrayService, type PrinterConfig } from '@/services/qzTrayService';
import { formatReceipt } from '@/services/receiptFormatter';
import { toast } from 'sonner';
import { Printer, RefreshCw, Wifi, WifiOff, TestTube, Volume2, VolumeX, Loader2 } from 'lucide-react';

const PrinterSettings = () => {
  const [config, setConfig] = useState<PrinterConfig>(qzTrayService.getConfig());
  const [printers, setPrinters] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setLoading(true);
    const ok = await qzTrayService.connect();
    setConnected(ok);
    if (ok) {
      const list = await qzTrayService.listPrinters();
      setPrinters(list);
    }
    setLoading(false);
  };

  const updateConfig = (partial: Partial<PrinterConfig>) => {
    const updated = qzTrayService.saveConfig(partial);
    setConfig(updated);
  };

  const testPrint = async () => {
    if (!config.printerName) {
      toast.error('Selecione uma impressora primeiro');
      return;
    }
    setTestPrinting(true);

    const testOrder = {
      order_number: 999,
      customer_name: 'Cliente Teste',
      customer_phone: '(11) 99999-9999',
      delivery_address: 'Rua Teste, 123',
      delivery_neighborhood: 'Centro',
      delivery_city: 'Sao Paulo',
      delivery_notes: null,
      payment_method: 'pix',
      subtotal: 45.90,
      delivery_fee: 5.00,
      discount: 0,
      coupon_code: null,
      total: 50.90,
      notes: 'Pedido de teste - impressora configurada!',
      created_at: new Date().toISOString(),
      restaurant_name: 'Meu Restaurante',
      items: [
        { product_name: 'X-Burger Especial', quantity: 2, unit_price: 18.95, total: 37.90, notes: 'Sem cebola', addons: null },
        { product_name: 'Refrigerante 350ml', quantity: 1, unit_price: 8.00, total: 8.00, notes: null, addons: null },
      ],
    };

    const receipt = formatReceipt(testOrder, config);
    const success = await qzTrayService.printRaw(receipt);

    if (success) {
      toast.success('Teste impresso com sucesso!');
    } else {
      toast.error('Falha na impressao de teste');
    }
    setTestPrinting(false);
  };

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            <div>
              <CardTitle className="font-display">Impressora Termica</CardTitle>
              <CardDescription>Configure a impressao automatica de pedidos via QZ Tray</CardDescription>
            </div>
          </div>
          <Badge
            variant={connected ? 'default' : 'destructive'}
            className={connected ? 'bg-green-500/20 text-green-700 border-green-500/30' : ''}
          >
            {connected ? (
              <><Wifi className="h-3 w-3 mr-1" /> QZ Tray Conectado</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> QZ Tray Desconectado</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!connected && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
            <p className="font-medium text-amber-800 mb-2">QZ Tray nao detectado</p>
            <p className="text-amber-700 mb-3">
              Para impressao automatica, instale o QZ Tray no computador onde a impressora esta conectada.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={checkConnection} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Tentar Conectar
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer">
                  Baixar QZ Tray
                </a>
              </Button>
            </div>
          </div>
        )}

        {connected && (
          <>
            {/* Printer selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Impressora</Label>
                <Button size="sm" variant="ghost" onClick={checkConnection} disabled={loading}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
              <Select value={config.printerName} onValueChange={(v) => updateConfig({ printerName: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma impressora..." />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Paper width */}
            <div className="space-y-2">
              <Label>Largura do Papel</Label>
              <Select value={config.paperWidth} onValueChange={(v: '58mm' | '80mm') => updateConfig({ paperWidth: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm (padrao)</SelectItem>
                  <SelectItem value="58mm">58mm (compacta)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toggles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Impressao Automatica</Label>
                  <p className="text-xs text-muted-foreground">Imprime automaticamente quando chega pedido novo</p>
                </div>
                <Switch
                  checked={config.autoPrint}
                  onCheckedChange={(v) => updateConfig({ autoPrint: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {config.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  <div className="space-y-0.5">
                    <Label>Som de Notificacao</Label>
                    <p className="text-xs text-muted-foreground">Toca um som quando o pedido e impresso</p>
                  </div>
                </div>
                <Switch
                  checked={config.soundEnabled}
                  onCheckedChange={(v) => updateConfig({ soundEnabled: v })}
                />
              </div>
            </div>

            {/* Copies */}
            <div className="space-y-2">
              <Label>Copias</Label>
              <Select value={String(config.copies)} onValueChange={(v) => updateConfig({ copies: parseInt(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 copia</SelectItem>
                  <SelectItem value="2">2 copias</SelectItem>
                  <SelectItem value="3">3 copias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Test print */}
            <Button onClick={testPrint} disabled={testPrinting || !config.printerName} className="w-full" variant="outline">
              {testPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TestTube className="h-4 w-4 mr-2" />}
              Imprimir Teste
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PrinterSettings;
