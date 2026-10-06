import React, { useMemo, useState } from 'react';
import {
  Bell,
  AlertTriangle,
  Check,
  CheckCheck,
  Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { parseDate } from '../components/dashboard/utils';

type Filter = 'unread' | 'all';

const relativeTime = (d: Date) => {
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `há ${diffD} ${diffD === 1 ? 'dia' : 'dias'}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export const Notifications = () => {
  const {
    notifications,
    products,
    markNotificationAsRead
  } = useApp();

  const [filter, setFilter] = useState<Filter>('unread');
  const [markingAll, setMarkingAll] = useState(false);

  const sorted = useMemo(
    () => [...(notifications || [])].sort((a, b) => (parseDate(b.timestamp)?.getTime() ?? 0) - (parseDate(a.timestamp)?.getTime() ?? 0)),
    [notifications]
  );
  const unread = sorted.filter(n => !n.read);
  const visible = filter === 'unread' ? unread : sorted;
  const productById = useMemo(() => new Map((products || []).map(p => [p.id, p])), [products]);

  const markRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
    } catch (err) {
      console.error('markNotificationAsRead failed:', err);
      toast.error('Não foi possível marcar o alerta como lido.');
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await Promise.all(unread.map(n => markNotificationAsRead(n.id)));
      toast.success('Todos os alertas foram marcados como lidos.');
    } catch (err) {
      console.error('markAllRead failed:', err);
      toast.error('Alguns alertas não puderam ser marcados como lidos.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="shrink-0 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Gestão de Alertas</h1>
          <p className="hidden md:block truncate text-sm text-zinc-500 dark:text-zinc-400">Avisos de estoque baixo e notificações do sistema.</p>
        </div>
        {unread.length > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={markingAll}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {markingAll ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CheckCheck size={15} aria-hidden="true" />}
            Marcar todos como lidos
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900/90 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs overflow-hidden">
        {/* Filtro + resumo */}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
          <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-700" role="group" aria-label="Filtrar alertas">
            {([['unread', 'Não lidos', unread.length], ['all', 'Todos', sorted.length]] as const).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  filter === value
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {label}
                <span className={`tabular-nums text-[10px] font-bold ${value === 'unread' && count > 0 ? 'text-red-500' : 'text-zinc-400'}`}>{count}</span>
              </button>
            ))}
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {unread.length === 0 ? 'Nenhum alerta pendente' : `${unread.length} ${unread.length === 1 ? 'pendente' : 'pendentes'}`}
          </span>
        </div>

        {visible.length > 0 ? (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {visible.map(n => {
              const product = n.productId ? productById.get(n.productId) : undefined;
              const date = parseDate(n.timestamp);
              const stockLow = product ? (product.quantity || 0) <= (product.minQuantity || 0) : false;
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${n.read ? 'bg-transparent' : 'bg-red-50/40 dark:bg-red-950/10'}`}
                >
                  <span className={`mt-0.5 shrink-0 p-1.5 rounded-lg border ${
                    n.read
                      ? 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-200/70 dark:border-zinc-700'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-900/40'
                  }`}>
                    <AlertTriangle size={15} aria-hidden="true" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {!n.read && <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-red-500" aria-label="Não lido" />}
                      <p className={`truncate text-sm ${n.read ? 'font-medium text-zinc-600 dark:text-zinc-400' : 'font-semibold text-zinc-900 dark:text-white'}`}>
                        {n.title}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{n.message}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {date && (
                        <time dateTime={date.toISOString()} title={date.toLocaleString('pt-BR')}>
                          {relativeTime(date)}
                        </time>
                      )}
                      {product && (
                        <span className={`inline-flex items-center gap-1 font-semibold ${stockLow ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          Estoque atual {product.quantity} / mín. {product.minQuantity}
                          {!stockLow && <span className="font-normal text-zinc-500 dark:text-zinc-400">· já reposto</span>}
                        </span>
                      )}
                    </div>
                  </div>

                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      title="Marcar como lido"
                      aria-label={`Marcar "${n.title}" como lido`}
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <Check size={14} aria-hidden="true" />
                      <span className="hidden sm:inline">Lido</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center text-center py-14 px-6">
            <span className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/40">
              <Bell size={20} aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">
              {filter === 'unread' && sorted.length > 0 ? 'Nenhum alerta pendente' : 'Nenhum alerta'}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">
              {filter === 'unread' && sorted.length > 0
                ? 'Tudo lido. Veja o histórico em "Todos".'
                : 'Tudo em ordem com o estoque. Novos avisos aparecem aqui.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
