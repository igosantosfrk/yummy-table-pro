import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrderSuccessScreenProps {
  orderNumber: number;
  onBackToMenu: () => void;
}

const OrderSuccessScreen = ({ orderNumber, onBackToMenu }: OrderSuccessScreenProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="px-4 max-w-md mx-auto text-center py-12"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
        className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-500/20 mb-6"
      >
        <CheckCircle2 className="h-10 w-10 text-green-500" />
      </motion.div>

      <h2 className="text-2xl font-display font-bold mb-2">Pedido Confirmado!</h2>
      <p className="text-muted-foreground mb-6">
        Seu pedido <span className="text-primary font-bold">#{orderNumber}</span> foi recebido com sucesso.
      </p>

      <p className="text-sm text-muted-foreground mb-8">
        Você receberá atualizações sobre o status do seu pedido.
      </p>

      <Button onClick={onBackToMenu} variant="outline" size="lg">
        Voltar ao Cardápio
      </Button>
    </motion.div>
  );
};

export default OrderSuccessScreen;
