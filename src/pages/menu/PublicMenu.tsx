import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Clock, MapPin, Phone, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  is_open: boolean | null;
  avg_delivery_time_min: number | null;
  delivery_fee: number | null;
  min_order_value: number | null;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

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

const PublicMenu = () => {
  const { slug } = useParams<{ slug: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data: t } = await supabase.from('tenants').select('*').eq('slug', slug).eq('status', 'active').single();
      if (!t) { setLoading(false); return; }
      setTenant(t);

      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from('categories').select('*').eq('tenant_id', t.id).eq('is_active', true).order('sort_order'),
        supabase.from('products').select('*').eq('tenant_id', t.id).eq('is_available', true).order('sort_order'),
      ]);
      setCategories(cats || []);
      setProducts(prods || []);
      if (cats?.length) setActiveCategory(cats[0].id);
      setLoading(false);
    };
    load();
  }, [slug]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    categoryRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold">Restaurante não encontrado</h1>
          <p className="text-muted-foreground mt-2">Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header / Banner */}
      <div className="relative">
        {tenant.banner_url ? (
          <div className="h-48 sm:h-64 overflow-hidden">
            <img src={tenant.banner_url} alt={tenant.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>
        ) : (
          <div className="h-48 sm:h-64 gradient-primary">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </div>
        )}

        {/* Restaurant info */}
        <div className="relative -mt-16 px-4 sm:px-6 max-w-2xl mx-auto">
          <div className="flex items-end gap-4">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt="" className="w-20 h-20 rounded-2xl border-4 border-background object-cover shadow-lg" />
            ) : (
              <div className="w-20 h-20 rounded-2xl border-4 border-background gradient-primary flex items-center justify-center shadow-lg">
                <span className="text-3xl font-display font-bold text-white">{tenant.name[0]}</span>
              </div>
            )}
            <div className="pb-1">
              <h1 className="text-2xl font-display font-bold text-foreground">{tenant.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {tenant.is_open ? (
                  <Badge className="bg-success text-success-foreground text-xs">Aberto</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">Fechado</Badge>
                )}
                {tenant.avg_delivery_time_min && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {tenant.avg_delivery_time_min} min
                  </span>
                )}
              </div>
            </div>
          </div>
          {tenant.description && (
            <p className="text-sm text-muted-foreground mt-3">{tenant.description}</p>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border mt-6">
          <div className="max-w-2xl mx-auto px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 py-3">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? 'gradient-primary text-white shadow-glow-sm'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Products */}
      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-8">
        {categories.map(cat => {
          const catProducts = products.filter(p => p.category_id === cat.id);
          if (catProducts.length === 0) return null;
          return (
            <div key={cat.id} ref={el => { categoryRefs.current[cat.id] = el; }}>
              <h2 className="text-xl font-display font-bold mb-4 text-foreground">
                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
              </h2>
              <div className="space-y-3">
                {catProducts.map((p, i) => {
                  const inCart = cart.find(c => c.product.id === p.id);
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex gap-4 p-3 rounded-xl glass hover:shadow-glow-sm transition-all cursor-pointer group"
                      onClick={() => addToCart(p)}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{p.name}</h3>
                        {p.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-lg font-bold text-primary">
                            R$ {p.price.toFixed(2)}
                          </span>
                          {p.prep_time_min && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {p.prep_time_min}min
                            </span>
                          )}
                        </div>
                        {inCart && (
                          <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(p.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-bold w-6 text-center">{inCart.quantity}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(p.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {p.image_url && (
                        <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Uncategorized products */}
        {products.filter(p => !p.category_id).length > 0 && (
          <div>
            <h2 className="text-xl font-display font-bold mb-4">Outros</h2>
            <div className="space-y-3">
              {products.filter(p => !p.category_id).map(p => (
                <div
                  key={p.id}
                  className="flex gap-4 p-3 rounded-xl glass cursor-pointer"
                  onClick={() => addToCart(p)}
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    <span className="text-lg font-bold text-primary">R$ {p.price.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cart FAB */}
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
                <button className="w-full gradient-primary text-white rounded-2xl p-4 flex items-center justify-between shadow-glow">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ShoppingCart className="h-6 w-6" />
                      <span className="absolute -top-2 -right-2 bg-white text-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
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
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="font-bold w-6 text-center">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, 1)}>
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
                  {tenant.delivery_fee && tenant.delivery_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa de entrega</span>
                      <span className="font-semibold">R$ {tenant.delivery_fee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">
                      R$ {(cartTotal + (tenant.delivery_fee || 0)).toFixed(2)}
                    </span>
                  </div>
                  <Button className="w-full gradient-primary text-white" size="lg">
                    Finalizar Pedido <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PublicMenu;
