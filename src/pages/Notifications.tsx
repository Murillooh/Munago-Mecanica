import React from 'react';
import { motion } from 'motion/react';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  Package, 
  Eye 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';

export const Notifications = () => {
  const { 
    notifications, 
    products, 
    markNotificationAsRead 
  } = useApp();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight uppercase">Gerenciamento de Alertas</h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold mt-1">Notificações críticas do sistema e avisos de estoque.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {notifications.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-20 text-center">
            <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-300 mx-auto mb-6">
              <Bell size={40} strokeWidth={1} />
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">NENHUM ALERTA</h3>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">Tudo em ordem com o seu estoque. Novas notificações aparecerão aqui.</p>
          </div>
        ) : (
          notifications.map((n, i) => {
            const product = products.find(p => p.id === n.productId);
            return (
              <motion.div 
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`p-8 rounded-[2.5rem] border transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                  n.read 
                    ? 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-100 dark:border-zinc-700 opacity-60' 
                    : 'bg-white dark:bg-zinc-900 border-red-100 dark:border-red-900/30 shadow-xl shadow-red-500/5'
                }`}
              >
                <div className="flex items-start gap-6">
                  <div className={`p-4 rounded-3xl ${n.read ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300' : 'bg-red-50 dark:bg-red-900/20 text-red-500 shadow-lg shadow-red-500/10'}`}>
                    <AlertTriangle size={32} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">{n.title}</h4>
                      {!n.read && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse">
                          Novo
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 mt-2 font-medium leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-6 mt-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        <Clock size={14} className="text-blue-500" />
                        {n.timestamp?.toDate ? n.timestamp.toDate().toLocaleString('pt-BR') : 'Agora'}
                      </div>
                      {product && (
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                          <Package size={14} />
                          Disponível: {product.quantity} un
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!n.read && (
                    <button 
                      onClick={() => markNotificationAsRead(n.id)}
                      className="px-6 py-3 bg-zinc-900 dark:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-600 shadow-lg transition-all active:scale-95"
                    >
                      Marcar como lido
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      toast.info(`Produto: ${product?.name || 'Não encontrado'}`);
                    }}
                    className="p-3 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-2xl transition-all"
                  >
                    <Eye size={24} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
