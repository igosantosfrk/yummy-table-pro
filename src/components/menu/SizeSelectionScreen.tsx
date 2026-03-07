import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  icon: string | null;
  parent_id?: string | null;
}

interface SizeSelectionScreenProps {
  parentCategory: Category;
  subCategories: Category[];
  onSelectSubCategory: (category: Category) => void;
  onBack: () => void;
}

const SizeSelectionScreen = ({ parentCategory, subCategories, onSelectSubCategory, onBack }: SizeSelectionScreenProps) => {
  return (
    <div className="max-w-2xl mx-auto px-4 mt-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[hsl(220,10%,55%)] hover:text-[hsl(220,14%,96%)] transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Voltar</span>
      </button>

      <h2 className="text-xl font-display font-bold text-foreground mb-2">
        {parentCategory.icon ? `${parentCategory.icon} ` : ''}{parentCategory.name}
      </h2>
      <p className="text-sm text-muted-foreground mb-6">Escolha o tamanho</p>

      <div className="space-y-3">
        {subCategories.map((sub, i) => (
          <motion.button
            key={sub.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelectSubCategory(sub)}
            className="w-full flex items-center justify-between p-4 rounded-xl glass hover:shadow-glow-sm transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              {sub.icon && <span className="text-2xl">{sub.icon}</span>}
              <span className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                {sub.name}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default SizeSelectionScreen;
