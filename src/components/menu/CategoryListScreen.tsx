import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  icon: string | null;
  parent_id?: string | null;
}

interface CategoryListScreenProps {
  categories: Category[];
  onSelectCategory: (category: Category) => void;
}

const CategoryListScreen = ({ categories, onSelectCategory }: CategoryListScreenProps) => {
  // Only show top-level categories (no parent)
  const topLevelCategories = categories.filter(c => !c.parent_id);

  return (
    <div className="max-w-2xl mx-auto px-4 mt-6">
      <h2 className="text-xl font-display font-bold text-foreground mb-4">Escolha uma categoria</h2>
      <div className="space-y-3">
        {topLevelCategories.map((cat, i) => (
          <motion.button
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelectCategory(cat)}
            className="w-full flex items-center justify-between p-4 rounded-xl glass hover:shadow-glow-sm transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              {cat.icon && <span className="text-2xl">{cat.icon}</span>}
              <span className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                {cat.name}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default CategoryListScreen;
