import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, Banknote, QrCode, Loader2, MapPin, User, Phone, Mail, MessageSquare, Tag, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { UtmParams } from '@/hooks/useMenuTracking';

interface CartItem {
  product: { id: string; name: string; price: number; image_url?: string | null; [key: string]: any };
  quantity: number;
  notes?: string;
}

interface CheckoutScreenProps {
  cart: CartItem[];
  tenantId: string;
  tenantSlug: string;
  deliveryFee: number | null;
  minOrderValue: number | null;
  sessionId: string;
  utmParams: UtmParams;
  onBack: () => void;
  onOrderComplete: (orderNumber: number) => void;
}

type PaymentMethod = 'online_card' | 'online_pix' | 'cash' | 'card_delivery';

interface AppliedCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  discountAmount: number;
}

const CheckoutScreen = ({
  cart, tenantId, tenantSlug, deliveryFee, minOrderValue, sessionId, utmParams, onBack, onOrderComplete
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

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const subtotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const discount = appliedCoupon?.discountAmount || 0;
  const total = Math.max(0, subtotal - discount + (deliveryFee || 0));
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    setCouponLoading(true);
    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error || !coupon) {
        toast({ title: 'Cupom inválido', description: 'Verifique o código e tente novamente', variant: 'destructive' });
        setCouponLoading(false);
        return;
      }

      // Check expiry
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        toast({ title: 'Cupom expirado', variant: 'destructive' });
        setCouponLoading(false);
        return;
      }

      // Check max uses
      if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
        toast({ title: 'Cupom esgotado', variant: 'destructive' });
        setCouponLoading(false);
        return;
      }

      // Check min order
      if (coupon.min_order_value && subtotal < coupon.min_order_value) {
        toast({ title: `Pedido mínimo para este cupom: R$ ${coupon.min_order_value.toFixed(2)}`, variant: 'destructive' });
        setCouponLoading(false);
        return;
      }

      const discountAmount = coupon.discount_type === 'percentage'
        ? subtotal * (coupon.discount_value / 100)
        : coupon.discount_value;

      setAppliedCoupon({
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discountAmount: Math.min(discountAmount, subtotal),
      });

      toast({ title: 'Cupom aplicado!', description: `Desconto de R$ ${Math.min(discountAmount, subtotal).toFixed(2)}` });
    } catch {
      toast({ title: 'Erro ao validar cupom', variant: 'destructive' });
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const items = cart.map(i => ({ name: i.product.name, price: i.product.price, quantity: i.quantity }));

  const basePayload = {
    tenant_id: tenantId, items, customer_name: customerName, customer_phone: customerPhone,
    customer_email: customerEmail || undefined, delivery_address: deliveryAddress || undefined,
    delivery_neighborhood: deliveryNeighborhood || undefined, delivery_city: deliveryCity || undefined,
    delivery_notes: deliveryNotes || undefined, delivery_fee: deliveryFee || 0,
    discount: discount, coupon_code: appliedCoupon?.code || undefined, coupon_id: appliedCoupon?.id || undefined,
    session_id: sessionId, ...utmParams,
  };

  const handleContinueToPayment = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({ title: 'Preencha nome e telefone', variant: 'destructive' }); return;
    }
    if (!deliveryAddress.trim()) {
      toast({ title: 'Preencha o endereço de entrega', variant: 'destructive' }); return;
    }
    if (minOrderValue && subtotal < minOrderValue) {
      toast({ title: `Pedido mínimo: R$ ${minOrderValue.toFixed(2)}`, description: `Faltam R$ ${(minOrderValue - subtotal).toFixed(2)} para atingir o mínimo`, variant: 'destructive' }); return;
    }
    setStep('payment');
  };

  const handleOnlinePayment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: basePayload });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: 'Erro ao processar pagamento', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleOfflinePayment = async (method: 'cash' | 'credit_card' | 'debit_card') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-cash-order', { body: { ...basePayload, payment_method: method } });
      if (error) throw error;
      if (data?.order_number) onOrderComplete(data.order_number);
    } catch (err: any) {
      toast({ title: 'Erro ao criar pedido', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleSelectPayment = (method: PaymentMethod) => {
    setPaymentMethod(method);
    if (method === 'online_card' || method === 'online_pix') handleOnlinePayment();
    else if (method === 'cash') handleOfflinePayment('cash');
    else if (method === 'card_delivery') handleOfflinePayment('credit_card');
  };

  const InputField = ({ icon: Icon, label, value, onChange, placeholder, required, type = 'text' }: any) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}{required && ' *'}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
        <input
          type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-800 placeholder:text-gray-300 text-sm focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={step === 'payment' ? () => setStep('info') : onBack} className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Voltar</span>
          </button>
          <div className="flex items-center gap-2">
            <div className={"flex items-center gap-1.5 text-xs font-medium " + (step === 'info' ? 'text-primary' : 'text-gray-300')}>
              <span className={"w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold " + (step === 'info' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400')}>1</span>
              <span className="hidden sm:inline">Dados</span>
            </div>
            <div className="w-6 h-px bg-gray-200" />
            <div className={"flex items-center gap-1.5 text-xs font-medium " + (step === 'payment' ? 'text-primary' : 'text-gray-300')}>
              <span className={"w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold " + (step === 'payment' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400')}>2</span>
              <span className="hidden sm:inline">Pagamento</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {step === 'info' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
            <h2 className="text-lg font-bold text-gray-900">Dados da Entrega</h2>
            <div className="space-y-4">
              <InputField icon={User} label="Nome" value={customerName} onChange={setCustomerName} placeholder="Seu nome completo" required />
              <div className="grid grid-cols-2 gap-3">
                <InputField icon={Phone} label="Telefone" value={customerPhone} onChange={setCustomerPhone} placeholder="(00) 00000-0000" required type="tel" />
                <InputField icon={Mail} label="Email" value={customerEmail} onChange={setCustomerEmail} placeholder="seu@email.com" />
              </div>
              <InputField icon={MapPin} label="Endereço" value={deliveryAddress} onChange={setDeliveryAddress} placeholder="Rua, número, complemento" required />
              <div className="grid grid-cols-2 gap-3">
                <InputField icon={MapPin} label="Bairro" value={deliveryNeighborhood} onChange={setDeliveryNeighborhood} placeholder="Bairro" />
                <InputField icon={MapPin} label="Cidade" value={deliveryCity} onChange={setDeliveryCity} placeholder="Cidade" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Observações</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3.5 top-3 h-4 w-4 text-gray-300" />
                  <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} placeholder="Ex: Apartamento 201, portão azul..." rows={2}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-800 placeholder:text-gray-300 text-sm focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none transition-all shadow-sm" />
                </div>
              </div>
            </div>

            {/* Coupon Section */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cupom de Desconto</label>
              {appliedCoupon ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-800">{appliedCoupon.code}</p>
                    <p className="text-xs text-emerald-600">
                      -{appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}%` : `R$ ${appliedCoupon.discount_value.toFixed(2)}`}
                      {' '}(- R$ {appliedCoupon.discountAmount.toFixed(2)})
                    </p>
                  </div>
                  <button onClick={removeCoupon} className="p-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
                    <X className="h-4 w-4 text-emerald-600" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                    <input
                      type="text" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Digite o código"
                      onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-800 placeholder:text-gray-300 text-sm focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all shadow-sm uppercase"
                    />
                  </div>
                  <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}
                    className="px-5 py-3 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all shadow-sm">
                    {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white border border-gray-100 p-4 space-y-2 shadow-sm">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal ({cartCount} {cartCount === 1 ? 'item' : 'itens'})</span>
                <span className="text-gray-700">R$ {subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600">Desconto</span>
                  <span className="text-emerald-600 font-medium">- R$ {discount.toFixed(2)}</span>
                </div>
              )}
              {(deliveryFee || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Entrega</span>
                  <span className="text-gray-700">R$ {(deliveryFee || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-50">
                <span className="text-gray-900">Total</span>
                <span className="text-primary">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={handleContinueToPayment}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-[15px] shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
              Escolher Pagamento
            </button>
          </motion.div>
        )}

        {step === 'payment' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Forma de Pagamento</h2>
              <p className="text-sm text-gray-400 mt-1">Total: <span className="text-primary font-bold">R$ {total.toFixed(2)}</span></p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pagar Online</p>
              {([
                { method: 'online_card' as const, icon: CreditCard, title: 'Cartão de Crédito / Débito', desc: 'Pagamento seguro via Stripe' },
                { method: 'online_pix' as const, icon: QrCode, title: 'PIX', desc: 'Pagamento instantâneo' },
              ]).map(opt => (
                <button key={opt.method} disabled={loading} onClick={() => handleSelectPayment(opt.method)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all text-left group shadow-sm">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <opt.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">{opt.title}</p>
                    <p className="text-[12px] text-gray-400">{opt.desc}</p>
                  </div>
                  {loading && paymentMethod === opt.method && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-2">Pagar na Entrega</p>
              {([
                { method: 'cash' as const, icon: Banknote, title: 'Dinheiro', desc: 'Pague em dinheiro ao receber' },
                { method: 'card_delivery' as const, icon: CreditCard, title: 'Cartão na Entrega', desc: 'Crédito ou débito na maquininha' },
              ]).map(opt => (
                <button key={opt.method} disabled={loading} onClick={() => handleSelectPayment(opt.method)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all text-left group shadow-sm">
                  <div className="h-11 w-11 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                    <opt.icon className="h-5 w-5 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">{opt.title}</p>
                    <p className="text-[12px] text-gray-400">{opt.desc}</p>
                  </div>
                  {loading && paymentMethod === opt.method && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CheckoutScreen;
