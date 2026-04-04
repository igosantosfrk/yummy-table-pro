import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Plus, Minus, ChevronRight, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  is_available: boolean | null;
  is_featured: boolean | null;
  prep_time_min: number | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

interface CartSheetProps {
  cart: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  deliveryFee: number | null;
  onCheckout?: () => void;
}

const CartSheet = ({ cart, cartOpen, setCartOpen, onUpdateQuantity, deliveryFee, onCheckout }: CartSheetProps) => {
  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <AnimatePresence>
      {cartCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="max-w-2xl mx-auto">
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <button className="w-full bg-gradient-to-r from-primary to-accent text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ShoppingBag className="h-5 w-5" />
                      <motion.span
                        key={cartCount}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2.5 bg-white text-primary text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow"
                      >
                        {cartCount}
                      </motion.span>
                    </div>
                    <span className="font-semibold text-[15px]">Ver Pedido</span>
                  </div>
                  <motion.span key={cartTotal} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="font-bold text-lg">
                    R$ {cartTotal.toFixed(2)}
                  </motion.span>
                </button>
              </SheetTrigger>

              <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl bg-white border-t border-gray-100 p-0">
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>
                <SheetHeader className="px-5 pb-4">
                  <SheetTitle className="text-xl font-bold text-gray-900">Seu Pedido</SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-4" style={{ maxHeight: 'calc(85vh - 250px)' }}>
                  {cart.map(item => (
                    <motion.div
                      key={item.product.id}
                      layout
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      {item.product.image_url && (
                        <img src={item.product.image_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-800 truncate">{item.product.name}</h4>
                        <p className="text-sm font-bold text-primary mt-0.5">R$ {(item.product.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, -1)}
                          className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors shadow-sm"
                        >
                          {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5 text-red-400" /> : <Minus className="h-3.5 w-3.5" />}
                        </button>
                        <span className="text-sm font-bold text-gray-800 w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, 1)}
                          className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="border-t border-gray-100 bg-white px-5 py-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-gray-700 font-medium">R$ {cartTotal.toFixed(2)}</span>
                  </div>
                  {deliveryFee != null && deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Taxa de entrega</span>
                      <span className="text-gray-700 font-medium">R$ {deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-1">
                    <span className="text-gray-900">Total</span>
                    <span className="text-primary">R$ {(cartTotal + (deliveryFee || 0)).toFixed(2)}</span>
                  </div>
                  <button
                    onClick={onCheckout}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-[15px] shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                  >
                    Finalizar Pedido
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartSheet;
