import React from 'react';
import { ShieldCheck, ChartNoAxesCombined, type LucideIcon } from 'lucide-react';

const FEATURES: { icon: LucideIcon; title: string; detail: string; accent: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Segurança de nível empresarial',
    detail: 'Login protegido, dados criptografados e acesso por perfil.',
    accent: 'from-emerald-300/40',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Relatórios e insights em tempo real',
    detail: 'Estoque, ordens de serviço e repasses atualizados na hora.',
    accent: 'from-amber-300/45',
  },
];

/** Destaques do painel azul das telas de acesso (login e espera de aprovação). */
export const AuthFeatures: React.FC = () => (
  <ul className="relative z-10 space-y-5 max-w-sm">
    {FEATURES.map(({ icon: Icon, title, detail, accent }) => (
      <li key={title} className="flex items-start gap-4">
        <span
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} to-white/5 ring-1 ring-inset ring-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_20px_-6px_rgba(15,23,42,0.6)] backdrop-blur-md`}
          aria-hidden="true"
        >
          <Icon size={22} strokeWidth={2} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
        </span>
        <span className="pt-0.5">
          <span className="block font-bold text-white">{title}</span>
          <span className="mt-0.5 block text-sm leading-snug text-blue-100/75">{detail}</span>
        </span>
      </li>
    ))}
  </ul>
);
