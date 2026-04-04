import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MenuHeader from '@/components/menu/MenuHeader';
import CategoryListScreen from '@/components/menu/CategoryListScreen';
import SizeSelectionScreen from '@/components/menu/SizeSelectionScreen';
import ProductListScreen from '@/components/menu/ProductListScreen';
import CartSheet from '@/components/menu/CartSheet';
import CheckoutScreen from '@/components/menu/CheckoutScreen';
import OrderSuccessScreen from '@/components/menu/OrderSuccessScreen';
import { useMenuTracking } from '@/hooks/useMenuTracking';

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
  parent_id?: string | null;
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

type Screen =
  | { type: 'categories' }
  | { type: 'sizes'; parentCategory: Category }
  | { type: 'products'; category: Category }
  | { type: 'checkout' }
  | { type: 'success'; orderNumber: number };

const PublicMenu = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>({ type: 'categories' });

  const { trackPageView, sessionId, utmParams } = useMenuTracking(tenant?.id || null);

  // Handle payment redirect from Stripe
  useEffect(() => {
    const payment = searchParams.get('payment');
    const orderNum = searchParams.get('order');
    if (payment === 'success' && orderNum) {
      setScreen({ type: 'success', orderNumber: parseInt(orderNum) });
    }
  }, [searchParams]);

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
      setLoading(false);
    };
    load();
  }, [slug]);

  const handleSelectCategory = (category: Category) => {
    trackPageView('category', category.id, category.name);
    const children = categories.filter(c => c.parent_id === category.id);
    if (children.length > 0) {
      setScreen({ type: 'sizes', parentCategory: category });
    } else {
      setScreen({ type: 'products', category });
    }
  };

  const handleSelectSubCategory = (category: Category) => {
    trackPageView('category', category.id, category.name);
    setScreen({ type: 'products', category });
  };

  const handleBackToCategories = () => setScreen({ type: 'categories' });

  const handleBackToSizes = (parentCategory: Category) => {
    setScreen({ type: 'sizes', parentCategory });
  };

  const addToCart = (product: Product) => {
    trackPageView('add_to_cart', product.id, product.name);
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

  const handleCheckout = () => {
    setCartOpen(false);
    setScreen({ type: 'checkout' });
  };

  const handleOrderComplete = (orderNumber: number) => {
    setCart([]);
    setScreen({ type: 'success', orderNumber });
  };

  const handleBackToMenu = () => {
    setScreen({ type: 'categories' });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] text-gray-800">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold">Restaurante não encontrado</h1>
          <p className="text-gray-400 mt-2">Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  const getProductBackHandler = (category: Category) => {
    if (category.parent_id) {
      const parent = categories.find(c => c.id === category.parent_id);
      if (parent) return () => handleBackToSizes(parent);
    }
    return handleBackToCategories;
  };

  const showCart = screen.type !== 'checkout' && screen.type !== 'success' && tenant.is_open !== false;

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-800 pb-24">
      {screen.type !== 'checkout' && screen.type !== 'success' && <MenuHeader tenant={tenant} />}

      {!tenant.is_open && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-center">
          <p className="text-red-700 font-semibold text-sm">Restaurante fechado no momento</p>
          <p className="text-red-500 text-xs mt-1">Volte mais tarde para fazer seu pedido</p>
        </div>
      )}

      <div className="mt-6">
        {screen.type === 'categories' && (
          <CategoryListScreen categories={categories} products={products} onSelectCategory={handleSelectCategory} onAddToCart={addToCart} />
        )}

        {screen.type === 'sizes' && (
          <SizeSelectionScreen
            parentCategory={screen.parentCategory}
            subCategories={categories.filter(c => c.parent_id === screen.parentCategory.id)}
            onSelectSubCategory={handleSelectSubCategory}
            onBack={handleBackToCategories}
          />
        )}

        {screen.type === 'products' && (
          <ProductListScreen
            category={screen.category}
            products={products}
            cart={cart}
            onAddToCart={addToCart}
            onUpdateQuantity={updateQuantity}
            onBack={getProductBackHandler(screen.category)}
          />
        )}

        {screen.type === 'checkout' && (
          <CheckoutScreen
            cart={cart}
            tenantId={tenant.id}
            tenantSlug={tenant.slug}
            deliveryFee={tenant.delivery_fee}
            minOrderValue={tenant.min_order_value}
            sessionId={sessionId}
            utmParams={utmParams}
            onBack={() => setScreen({ type: 'categories' })}
            onOrderComplete={handleOrderComplete}
          />
        )}

        {screen.type === 'success' && (
          <OrderSuccessScreen orderNumber={screen.orderNumber} onBackToMenu={handleBackToMenu} />
        )}
      </div>

      {showCart && (
        <CartSheet
          cart={cart}
          cartOpen={cartOpen}
          setCartOpen={setCartOpen}
          onUpdateQuantity={updateQuantity}
          deliveryFee={tenant.delivery_fee}
          onCheckout={handleCheckout}
        />
      )}
    </div>
  );
};

export default PublicMenu;
