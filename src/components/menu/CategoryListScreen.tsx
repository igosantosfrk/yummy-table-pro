import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Flame, Plus } from 'lucide-react';

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

interface CategoryListScreenProps {
  categories: Category[];
  products?: Product[];
  onSelectCategory: (category: Category) => void;
  onAddToCart?: (product: Product) => void;
}

// Fallback colors for categories without emoji
const categoryColors = [
  'from-orange-400 to-red-400',
  'from-blue-400 to-indigo-500',
  'from-emerald-400 to-teal-500',
  'from-purple-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-blue-500',
  'from-rose-400 to-red-500',
  'from-lime-400 to-green-500',
];

const categoryBgs = [
  'bg-orange-50',
  'bg-blue-50',
  'bg-emerald-50',
  'bg-purple-50',
  'bg-amber-50',
  'bg-cyan-50',
  'bg-rose-50',
  'bg-lime-50',
];

const CategoryListScreen = ({ categories, products = [], onSelectCategory, onAddToCart }: CategoryListScreenProps) => {
  const [search, setSearch] = useState('');
  const topLevelCategories = categories.filter(c => !c.parent_id);
  const featuredProducts = products.filter(p => p.is_featured && p.is_available);

  const searchResults = search.length >= 2
    ? products.filter(p =>
        p.is_available &&
        (p.name.toLowerCase().includes(search.toLowerCase()) ||
         p.description?.toLowerCase().includes(search.toLowerCase()))
      )
    : [];

  const getProductCount = (catId: string) => {
    const childCats = categories.filter(c => c.parent_id === catId).map(c => c.id);
    const allCatIds = [catId, ...childCats];
    return products.filter(p => p.is_available && p.category_id && allCatIds.includes(p.category_id)).length;
  };

  return (
    <div className="max-w-2xl mx-auto px-4">
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar no cardápio..."
          className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white border border-gray-200/80 text-gray-800 placeholder:text-gray-400 text-sm focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
        />
      </div>

      {/* Search Results */}
      {search.length >= 2 && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-semibold">
            {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
          </p>
          {searchResults.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Nenhum produto encontrado</p>
          ) : (
            <div className="space-y-2">
              {searchResults.slice(0, 8).map((p, i) => (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => onAddToCart?.(p)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all text-left shadow-sm"
                >
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center"><span className="text-lg">🍽️</span></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-sm font-bold text-orange-500">R$ {p.price.toFixed(2)}</p>
                  </div>
                  <span className="text-[11px] font-bold text-orange-500 bg-orange-50 px-2.5 py-1.5 rounded-lg border border-orange-100">+ Add</span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Featured Products */}
      {!search && featuredProducts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Mais Pedidos</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4">
            {featuredProducts.slice(0, 6).map((p, i) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onAddToCart?.(p)}
                className="flex-shrink-0 w-[140px] rounded-2xl bg-white border border-gray-100 overflow-hidden hover:shadow-lg hover:border-orange-200 transition-all group shadow-sm"
              >
                {p.image_url ? (
                  <div className="h-[100px] overflow-hidden">
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className={"h-[100px] flex items-center justify-center " + categoryBgs[i % categoryBgs.length]}>
                    <span className="text-4xl">🍽️</span>
                  </div>
                )}
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-gray-700 line-clamp-2 leading-tight min-h-[32px]">{p.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm font-bold text-orange-500">R$ {p.price.toFixed(2)}</p>
                    <span className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5 text-white" />
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      {!search && (
        <>
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">Cardápio</h2>
          <div className="grid grid-cols-2 gap-3">
            {topLevelCategories.map((cat, i) => {
              const count = getProductCount(cat.id);
              const bgColor = categoryBgs[i % categoryBgs.length];
              const gradColor = categoryColors[i % categoryColors.length];
              return (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => onSelectCategory(cat)}
                  className={"relative flex flex-col items-center justify-center p-5 rounded-2xl border border-gray-100/80 hover:shadow-lg hover:border-orange-200/60 transition-all group text-center min-h-[130px] shadow-sm " + bgColor}
                >
                  {cat.icon ? (
                    <span className="text-4xl mb-2 group-hover:scale-110 transition-transform drop-shadow-sm">{cat.icon}</span>
                  ) : (
                    <div className={"w-12 h-12 rounded-xl bg-gradient-to-br " + gradColor + " flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform"}>
                      <span className="text-white font-bold text-lg">{cat.name[0]}</span>
                    </div>
                  )}
                  <span className="text-sm font-semibold text-gray-800 group-hover:text-orange-600 transition-colors leading-tight">
                    {cat.name}
                  </span>
                  {count > 0 && (
                    <span className="text-[11px] text-gray-400 mt-1 font-medium">{count} itens</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default CategoryListScreen;
