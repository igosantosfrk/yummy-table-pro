import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Minus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
          className="fixed bottom-6 left-4 right-4 max-w-2xl mx-auto z-40"
        >
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <button className="w-full gradient-primary text-primary-foreground rounded-2xl p-4 flex items-center justify-between shadow-glow">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ShoppingCart className="h-6 w-6" />
                    <span className="absolute -top-2 -right-2 bg-background text-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {cartCount}
                    </span>
                  </div>
                  <span className="font-semibold">Ver carrinho</span>
                </div>
                <span className="font-bold text-lg">R$ {cartTotal.toFixed(2)}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
              <SheetHeader>
                <SheetTitle className="font-display text-xl">Seu Pedido</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 overflow-y-auto flex-1">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{item.product.name}</h4>
                      <p className="text-sm text-primary font-bold">
                        R$ {(item.product.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onUpdateQuantity(item.product.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-bold w-6 text-center">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onUpdateQuantity(item.product.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">R$ {cartTotal.toFixed(2)}</span>
                </div>
                {deliveryFee && deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa de entrega</span>
                    <span className="font-semibold">R$ {deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">
                    R$ {(cartTotal + (deliveryFee || 0)).toFixed(2)}
                  </span>
                </div>
                <Button className="w-full gradient-primary text-primary-foreground" size="lg">
                  Finalizar Pedido <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartSheet;
