import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Plus, Minus } from 'lucide-react';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Voltar</span>
      </button>

      <div className="flex items-center gap-2 mb-5">
        {category.icon && <span className="text-2xl">{category.icon}</span>}
        <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
        <span className="text-xs text-gray-300 ml-1">({categoryProducts.length})</span>
      </div>

      {categoryProducts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">Nenhum produto disponível nesta categoria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categoryProducts.map((p, i) => {
            const inCart = cart.find(c => c.product.id === p.id);
            const isExpanded = expandedId === p.id;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl bg-white border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all shadow-sm"
              >
                <div
                  className="flex gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                >
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-start gap-2">
                      <h3 className="font-semibold text-gray-800 text-[15px] leading-tight">{p.name}</h3>
                      {p.is_featured && (
                        <span className="flex-shrink-0 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">TOP</span>
                      )}
                    </div>
                    {p.description && (
                      <p className={"text-[13px] text-gray-400 mt-1 leading-relaxed " + (isExpanded ? '' : 'line-clamp-2')}>
                        {p.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="text-lg font-bold text-primary">R$ {p.price.toFixed(2)}</span>
                      {p.prep_time_min && (
                        <span className="text-[11px] text-gray-300 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {p.prep_time_min}min
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative flex-shrink-0">
                    {p.image_url ? (
                      <div className="w-24 h-24 rounded-xl overflow-hidden">
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-xl bg-gray-50 flex items-center justify-center">
                        <span className="text-2xl opacity-30">🍽️</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-3 pb-3">
                  <AnimatePresence mode="wait">
                    {inCart ? (
                      <motion.div
                        key="qty"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-xl px-3 py-2"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onUpdateQuantity(p.id, -1)}
                          className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors shadow-sm"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-bold text-gray-800">{inCart.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(p.id, 1)}
                          className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="add"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); onAddToCart(p); }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-sm font-semibold hover:shadow-lg active:scale-[0.98] transition-all shadow-md"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductListScreen;
