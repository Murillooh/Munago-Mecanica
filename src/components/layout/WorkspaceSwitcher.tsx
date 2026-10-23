import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';

interface WorkspaceOption { id: string; name: string; userCount?: number }

const users = (n = 0) => `${n} ${n === 1 ? 'usuário' : 'usuários'}`;

/**
 * Cartão "Oficina ativa" do menu com lista própria (a nativa do navegador destoa do visual).
 * Teclado: Enter/Espaço/↓ abre, ↑↓ navega, Enter escolhe, Esc fecha. Clique fora fecha.
 */
export const WorkspaceSwitcher: React.FC<{
  workspaces: WorkspaceOption[];
  activeId: string;
  myId?: string;
  fallbackName: string;
  onSwitch: (id: string) => void;
}> = ({ workspaces, activeId, myId, fallbackName, onSwitch }) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const active = workspaces.find(w => w.id === activeId);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const openList = () => {
    setFocused(Math.max(0, workspaces.findIndex(w => w.id === activeId)));
    setOpen(true);
  };
  const choose = (id: string) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (id !== activeId) onSwitch(id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); buttonRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(i => (i + 1) % workspaces.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(i => (i - 1 + workspaces.length) % workspaces.length); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(workspaces[focused].id); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Oficina ativa: ${active?.name ?? fallbackName}. Trocar de oficina`}
        className="w-full rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-3 text-left text-white shadow-lg shadow-blue-900/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 cursor-pointer"
      >
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-blue-100/80">Oficina ativa</span>
        <span className="mt-1.5 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15">
            <Building2 size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold" title={active?.name ?? fallbackName}>{active?.name ?? fallbackName}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-blue-100/80">
              {active?.id === myId && <span className="rounded bg-white/20 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-white">minha</span>}
              <span className="truncate">{users(active?.userCount)} · {workspaces.length} oficinas</span>
            </span>
          </span>
          <ChevronsUpDown size={16} className="shrink-0 text-blue-100/80" aria-hidden="true" />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label="Oficinas"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            style={{ transformOrigin: 'top center' }}
            className="absolute inset-x-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-zinc-200/80 bg-white/90 p-1.5 shadow-2xl shadow-black/20 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/90"
          >
            {workspaces.map((w, i) => {
              const selected = w.id === activeId;
              return (
                <li
                  key={w.id}
                  role="option"
                  aria-selected={selected}
                  onPointerEnter={() => setFocused(i)}
                  onClick={() => choose(w.id)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 ${focused === i ? 'bg-zinc-900/5 dark:bg-white/10' : ''}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${selected ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-zinc-400 to-zinc-600'}`}>
                    <Building2 size={14} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block break-words text-sm font-medium text-zinc-900 dark:text-white">{w.name}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {w.id === myId && <span className="rounded bg-blue-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">minha</span>}
                      {users(w.userCount)}
                    </span>
                  </span>
                  {selected && <Check size={16} className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};
