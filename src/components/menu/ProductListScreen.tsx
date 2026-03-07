import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

interface Category {
  id: string;
  name: string;
  icon: string | null;
  parent_id?: string | null;
}

interface ProductListScreenProps {
  category: Category;
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onBack: () => void;
}

const ProductListScreen = ({ category, products, cart, onAddToCart, onUpdateQuantity, onBack }: ProductListScreenProps) => {
  const categoryProducts = products.filter(p => p.category_id === category.id);

  return (
    <div className="max-w-2xl mx-auto px-4 mt-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)] transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Voltar</span>
      </button>

      <h2 className="text-xl font-display font-bold text-[hsl(220,14%,96%)] mb-4">
        {category.icon ? `${category.icon} ` : ''}{category.name}
      </h2>

      {categoryProducts.length === 0 ? (
        <p className="text-[hsl(220,10%,55%)] text-sm">Nenhum produto disponível nesta categoria.</p>
      ) : (
        <div className="space-y-3">
          {categoryProducts.map((p, i) => {
            const inCart = cart.find(c => c.product.id === p.id);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-4 p-3 rounded-xl glass hover:shadow-glow-sm transition-all cursor-pointer group"
                onClick={() => onAddToCart(p)}
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
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onUpdateQuantity(p.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold w-6 text-center">{inCart.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onUpdateQuantity(p.id, 1)}>
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
      )}
    </div>
  );
};

export default ProductListScreen;
