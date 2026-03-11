import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Banknote, QrCode, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { UtmParams } from '@/hooks/useMenuTracking';

interface Product {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

interface CheckoutScreenProps {
  cart: CartItem[];
  tenantId: string;
  tenantSlug: string;
  deliveryFee: number | null;
  sessionId: string;
  utmParams: UtmParams;
  onBack: () => void;
  onOrderComplete: (orderNumber: number) => void;
}

type PaymentMethod = 'online_card' | 'online_pix' | 'cash' | 'card_delivery';

const CheckoutScreen = ({
  cart, tenantId, tenantSlug, deliveryFee, sessionId, utmParams, onBack, onOrderComplete
}: CheckoutScreenProps) => {
  const [step, setStep] = useState<'info' | 'payment'>('info');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const subtotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const total = subtotal + (deliveryFee || 0);

  const items = cart.map(i => ({
    name: i.product.name,
    price: i.product.price,
    quantity: i.quantity,
  }));

  const basePayload = {
    tenant_id: tenantId,
    items,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail || undefined,
    delivery_address: deliveryAddress || undefined,
    delivery_neighborhood: deliveryNeighborhood || undefined,
    delivery_city: deliveryCity || undefined,
    delivery_notes: deliveryNotes || undefined,
    delivery_fee: deliveryFee || 0,
    session_id: sessionId,
    ...utmParams,
  };

  const handleContinueToPayment = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({ title: 'Preencha nome e telefone', variant: 'destructive' });
      return;
    }
    if (!deliveryAddress.trim()) {
      toast({ title: 'Preencha o endereço de entrega', variant: 'destructive' });
      return;
    }
    setStep('payment');
  };

  const handleOnlinePayment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: basePayload,
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: 'Erro ao processar pagamento', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOfflinePayment = async (method: 'cash' | 'credit_card' | 'debit_card') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-cash-order', {
        body: { ...basePayload, payment_method: method },
      });
      if (error) throw error;
      if (data?.order_number) {
        onOrderComplete(data.order_number);
      }
    } catch (err: any) {
      toast({ title: 'Erro ao criar pedido', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPayment = (method: PaymentMethod) => {
    setPaymentMethod(method);
    if (method === 'online_card' || method === 'online_pix') {
      handleOnlinePayment();
    } else if (method === 'cash') {
      handleOfflinePayment('cash');
    } else if (method === 'card_delivery') {
      handleOfflinePayment('credit_card');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="px-4 max-w-2xl mx-auto"
    >
      <button
        onClick={step === 'payment' ? () => setStep('info') : onBack}
        className="flex items-center gap-2 text-muted-foreground mb-6 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>{step === 'payment' ? 'Voltar' : 'Voltar ao carrinho'}</span>
      </button>

      <h2 className="text-xl font-display font-bold mb-6">
        {step === 'info' ? 'Dados da Entrega' : 'Forma de Pagamento'}
      </h2>

      {step === 'info' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Seu nome completo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço de Entrega *</Label>
            <Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Rua, número, complemento" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={deliveryNeighborhood} onChange={e => setDeliveryNeighborhood(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={deliveryCity} onChange={e => setDeliveryCity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} placeholder="Ex: Apartamento 201, portão azul..." />
          </div>

          {/* Order summary */}
          <div className="border-t border-border pt-4 mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} itens)</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            {(deliveryFee || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de entrega</span>
                <span>R$ {(deliveryFee || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          <Button onClick={handleContinueToPayment} className="w-full gradient-primary text-primary-foreground mt-4" size="lg">
            Escolher Pagamento
          </Button>
        </div>
      )}

      {step === 'payment' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Total: <span className="text-primary font-bold text-lg">R$ {total.toFixed(2)}</span>
          </p>

          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pagar Online</h3>

          <button
            disabled={loading}
            onClick={() => handleSelectPayment('online_card')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Cartão de Crédito / Débito</p>
              <p className="text-xs text-muted-foreground">Pagamento seguro via Stripe</p>
            </div>
            {loading && paymentMethod === 'online_card' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </button>

          <button
            disabled={loading}
            onClick={() => handleSelectPayment('online_pix')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">PIX</p>
              <p className="text-xs text-muted-foreground">Pagamento instantâneo via PIX</p>
            </div>
            {loading && paymentMethod === 'online_pix' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </button>

          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-4">Pagar na Entrega</h3>

          <button
            disabled={loading}
            onClick={() => handleSelectPayment('cash')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Dinheiro</p>
              <p className="text-xs text-muted-foreground">Pague em dinheiro ao receber</p>
            </div>
            {loading && paymentMethod === 'cash' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </button>

          <button
            disabled={loading}
            onClick={() => handleSelectPayment('card_delivery')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Cartão na Entrega</p>
              <p className="text-xs text-muted-foreground">Crédito ou débito na maquininha</p>
            </div>
            {loading && paymentMethod === 'card_delivery' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default CheckoutScreen;
