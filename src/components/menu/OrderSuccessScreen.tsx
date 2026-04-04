import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, ArrowRight } from 'lucide-react';

interface OrderSuccessScreenProps {
  orderNumber: number;
  onBackToMenu: () => void;
}

const OrderSuccessScreen = ({ orderNumber, onBackToMenu }: OrderSuccessScreenProps) => {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-sm w-full text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2, stiffness: 200 }} className="relative inline-flex items-center justify-center mb-8">
          <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          {showConfetti && (
            <>
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                  animate={{ opacity: 0, scale: 1, x: Math.cos(i * 45 * Math.PI / 180) * 60, y: Math.sin(i * 45 * Math.PI / 180) * 60 }}
                  transition={{ duration: 0.8, delay: 0.4 + i * 0.05 }}
                  className={"absolute w-2 h-2 rounded-full " + ['bg-primary', 'bg-emerald-400', 'bg-yellow-400', 'bg-blue-400', 'bg-pink-400', 'bg-orange-400', 'bg-purple-400', 'bg-cyan-400'][i]}
                />
              ))}
            </>
          )}
        </motion.div>

        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-2xl font-bold text-gray-900 mb-2">
          Pedido Confirmado!
        </motion.h2>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="space-y-4">
          <p className="text-gray-500">Seu pedido <span className="text-primary font-bold text-lg">#{orderNumber}</span> foi recebido</p>

          <div className="rounded-2xl bg-white border border-gray-100 p-5 text-left space-y-3 mt-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Preparando seu pedido</p>
                <p className="text-xs text-gray-400">Você será notificado sobre o status</p>
              </div>
            </div>
            <div className="flex items-center gap-1 pt-2">
              <div className="flex-1 h-1.5 rounded-full bg-primary" />
              <div className="flex-1 h-1.5 rounded-full bg-gray-100" />
              <div className="flex-1 h-1.5 rounded-full bg-gray-100" />
              <div className="flex-1 h-1.5 rounded-full bg-gray-100" />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 font-medium">
              <span className="text-primary">Recebido</span>
              <span>Preparando</span>
              <span>Saiu</span>
              <span>Entregue</span>
            </div>
          </div>

          <button onClick={onBackToMenu}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 hover:shadow-md transition-all mt-4 shadow-sm">
            Voltar ao Cardápio
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OrderSuccessScreen;
