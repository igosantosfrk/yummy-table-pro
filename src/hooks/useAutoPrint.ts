import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { qzTrayService } from '@/services/qzTrayService';
import { formatReceipt } from '@/services/receiptFormatter';
import { toast } from 'sonner';

const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczFjWJ0teleEAsXKLa4LFkKBEyjdzt0oNEIUqb3OzLfDwcN5Xf8tqJRyBGnuDw1YlHIEih4/PZiUggSaLj89qJSCBJouPz2YlIIEmi4/PaiUggSqLj89eJSCBKouTz2IlIIEui5PPViUkgTKPk89KJSSBPpOXzzolKIFOl5fPKiUsgV6bn88SJTSBjqOf0wIlQIHCq6fS8iVMgfK7r9LaJWSCMsu/2rollIJu08PSwimcgoLfx9aeKbyCmuvP2oIp2IK6+9PaYin8gtcL19o6KiCC9xvf2gopzIL3G9/Z+im0gvcb39naKZyC9xvf2bopgIL3G9/Zmilkgvcb39l6KUiC9xvf2VopLIL3G9/ZOikQgvcb39kaKPSC9xvf2PopzIL3G9/Y2ijYgvcb39i6KLyC9xvf2';

export function useAutoPrint(tenantId: string | null | undefined) {
  const printedOrdersRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.8;
  }, []);

  const playSound = useCallback(() => {
    const config = qzTrayService.getConfig();
    if (config.soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const printOrder = useCallback(async (orderId: string) => {
    const config = qzTrayService.getConfig();
    if (!config.autoPrint || !config.printerName) return;

    // Avoid duplicate prints
    if (printedOrdersRef.current.has(orderId)) return;
    printedOrdersRef.current.add(orderId);

    try {
      // Fetch order data
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!order) return;

      // Fetch order items
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      // Fetch restaurant name
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', order.tenant_id)
        .single();

      const receiptData = {
        ...order,
        items: items || [],
        restaurant_name: tenant?.name || '',
      };

      const receipt = formatReceipt(receiptData, config);
      const success = await qzTrayService.printRaw(receipt);

      if (success) {
        playSound();
        toast.success('Pedido #' + order.order_number + ' impresso!', {
          duration: 3000,
        });
      } else {
        toast.error('Falha ao imprimir pedido #' + order.order_number, {
          description: 'Verifique se o QZ Tray esta aberto e a impressora conectada.',
          duration: 5000,
        });
      }
    } catch (err) {
      console.error('Erro ao imprimir pedido:', err);
    }
  }, [playSound]);

  useEffect(() => {
    if (!tenantId) return;

    const config = qzTrayService.getConfig();
    if (!config.autoPrint || !config.printerName) return;

    // Connect to QZ Tray on mount
    qzTrayService.connect();

    const channel = supabase
      .channel('auto-print-orders')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: 'tenant_id=eq.' + tenantId,
      }, (payload) => {
        const newOrder = payload.new as any;
        if (newOrder && newOrder.status === 'new') {
          printOrder(newOrder.id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, printOrder]);

  return { printOrder };
}
