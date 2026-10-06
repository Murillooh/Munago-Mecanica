import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Search, 
  Trash2, 
  User, 
  Car, 
  Wrench, 
  Save, 
  X, 
  CheckCircle2, 
  MessageCircle, 
  History,
  Package,
  PlusCircle,
  MinusCircle,
  Search as SearchIcon,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { splitRevenue } from '../../server/services/revenueSplit';

type OSStatus = 'draft' | 'in_progress' | 'completed' | 'paid';

const OS_STEPS: { value: OSStatus; label: string }[] = [
  { value: 'draft', label: 'Orçamento' },
  { value: 'in_progress', label: 'Em manutenção' },
  { value: 'completed', label: 'Aguardando retirada' },
  { value: 'paid', label: 'Pago' },
];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_META: Record<OSStatus, { label: string; chip: string; dot: string; icon: React.ElementType; badge: string }> = {
  draft: {
    label: 'Orçamento',
    chip: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    dot: 'bg-zinc-400',
    icon: FileText,
    badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200/70 dark:border-zinc-700',
  },
  in_progress: {
    label: 'Em manutenção',
    chip: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    dot: 'bg-amber-500',
    icon: Wrench,
    badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/40',
  },
  completed: {
    label: 'Aguardando retirada',
    chip: 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
    dot: 'bg-blue-500',
    icon: Car,
    badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/40',
  },
  paid: {
    label: 'Pago',
    chip: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
    badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/40',
  },
};

type StatusFilter = 'all' | 'active' | OSStatus;

const formatEntry = (value?: string) => {
  if (!value) return 'Sem data';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const whatsappLink = (phone?: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
};

/** Placa em miniatura no padrão Mercosul, igual à da ficha. */
const PlateBadge: React.FC<{ plate?: string }> = ({ plate }) => (
  <span className="inline-flex flex-col overflow-hidden rounded-[4px] border border-zinc-900 dark:border-zinc-300 bg-white leading-none shrink-0">
    <span className="h-[3px] bg-[#003399]" aria-hidden="true" />
    <span className="px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-zinc-900">
      {plate || 'S/ PLACA'}
    </span>
  </span>
);

const fieldClass =
  'w-full rounded-lg border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-[15px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-colors focus:border-blue-600 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-600/15 disabled:opacity-60';

const Field: React.FC<{ id: string; label: string; hint?: string; children: React.ReactNode }> = ({ id, label, hint, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {label}
      {hint && <span className="ml-1.5 font-normal text-zinc-400">{hint}</span>}
    </label>
    {children}
  </div>
);

/** Campo de placa desenhado como placa Mercosul: é o que a recepção da oficina reconhece de relance. */
const PlateInput: React.FC<{ id: string; value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ id, value, onChange, disabled }) => (
  <div className="w-full max-w-[13.5rem] overflow-hidden rounded-md border-2 border-zinc-900 bg-white shadow-sm transition-shadow focus-within:ring-4 focus-within:ring-blue-600/25 dark:border-zinc-300">
    <div className="flex items-center justify-between bg-[#003399] px-2 py-[3px] text-[9px] font-semibold tracking-[0.35em] text-white" aria-hidden="true">
      <span>BR</span>
      <span>BRASIL</span>
      <span className="w-3" />
    </div>
    <input
      id={id}
      value={value}
      onChange={e => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
      maxLength={8}
      placeholder="ABC1D23"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      className="w-full bg-white py-1.5 text-center font-mono text-[1.6rem] font-bold uppercase tracking-[0.12em] text-zinc-900 outline-none placeholder:text-zinc-300 disabled:opacity-60"
    />
  </div>
);

export const ServiceOrders = () => {
  const { 
    serviceOrders, 
    products, 
    addServiceOrder, 
    updateServiceOrder, 
    deleteServiceOrder, 
    canManageOS,
    profile,
    settings
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOS, setSelectedOS] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // OS Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [generalLaborCost, setGeneralLaborCost] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [osStatus, setOsStatus] = useState<OSStatus>('draft');
  const [observations, setObservations] = useState('');
  const [companyPct, setCompanyPct] = useState(0);
  const [activeModalTab, setActiveModalTab] = useState<'client' | 'items'>('client');
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  useEffect(() => {
    if (selectedOS) {
      setCustomerName(selectedOS.customerName);
      setCustomerPhone(selectedOS.customerPhone || '');
      setVehicleModel(selectedOS.vehicleModel || '');
      setVehiclePlate(selectedOS.vehiclePlate || '');
      setScheduledDate(selectedOS.scheduledDate || '');
      setCompletionDate(selectedOS.completionDate || '');
      setGeneralLaborCost(selectedOS.generalLaborCost || 0);
      setItems(selectedOS.items || []);
      setOsStatus(selectedOS.status || 'draft');
      setObservations(selectedOS.observations || '');
      setCompanyPct(selectedOS.companySharePercent ?? settings.companySharePercent ?? 0);
    } else {
      setCustomerName('');
      setCustomerPhone('');
      setVehicleModel('');
      setVehiclePlate('');
      setScheduledDate(new Date().toISOString().slice(0, 16));
      setCompletionDate('');
      setGeneralLaborCost(0);
      setItems([]);
      setOsStatus('draft');
      setObservations('');
      setCompanyPct(settings.companySharePercent ?? 0);
    }
    setActiveModalTab('client');
  }, [selectedOS, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isProductDropdownOpen) setIsProductDropdownOpen(false);
      else setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen, isProductDropdownOpen]);

  const totalParts = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const totalItemsLabor = items.reduce((acc, i) => acc + (i.laborCost * i.quantity), 0);
  const totalOSLabor = totalItemsLabor + generalLaborCost;
  const totalOSAmount = totalParts + totalOSLabor;
  const split = splitRevenue(totalOSAmount, companyPct);

  const allOS = serviceOrders || [];
  const statusStats = OS_STEPS.map(step => {
    const list = allOS.filter(os => os.status === step.value);
    return { ...step, count: list.length, amount: list.reduce((a, os) => a + (os.totalAmount || 0), 0) };
  });
  const activeCount = allOS.filter(os => os.status === 'draft' || os.status === 'in_progress').length;

  const filteredOS = allOS
    .filter(os => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q ||
        os.customerName?.toLowerCase().includes(q) ||
        os.vehiclePlate?.toLowerCase().includes(q) ||
        os.vehicleModel?.toLowerCase().includes(q) ||
        os.id.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return os.status === 'draft' || os.status === 'in_progress';
      return os.status === statusFilter;
    })
    .sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || ''));

  const filterCount = (f: StatusFilter) =>
    f === 'all' ? allOS.length : f === 'active' ? activeCount : allOS.filter(os => os.status === f).length;

  const handleAddItem = (product: any) => {
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      setItems(items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * (i.price + i.laborCost) } : i));
    } else {
      setItems([...items, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.price || 0,
        laborCost: product.laborCost || 0,
        total: (product.price || 0) + (product.laborCost || 0)
      }]);
    }
    toast.success(`${product.name} adicionado.`);
  };

  const handleRemoveItem = (id: string) => {
    setItems((items || []).filter(i => i.productId !== id));
  };

  const handleUpdateItemQuantity = (id: string, qty: number) => {
    if (qty < 1) return;
    setItems(items.map(i => i.productId === id ? { ...i, quantity: qty, total: qty * (i.price + i.laborCost) } : i));
  };

  const handleSaveOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName) {
      toast.error('Informe o nome do cliente');
      return;
    }
    
    setIsSaving(true);
    const osData = {
      customerName,
      customerPhone,
      vehicleModel,
      vehiclePlate,
      scheduledDate,
      completionDate,
      generalLaborCost,
      items,
      status: osStatus,
      observations,
      totalAmount: totalOSAmount,
      // O servidor calcula e congela os valores; daqui só vai o % (e só quando paga).
      companySharePercent: osStatus === 'paid' ? companyPct : undefined,
      updatedAt: new Date()
    };

    try {
      if (selectedOS) {
        await updateServiceOrder(selectedOS.id, osData);
        toast.success('Ordem de serviço atualizada!');
      } else {
        await addServiceOrder({ ...osData, createdAt: new Date() });
        toast.success('Nova ordem de serviço criada!');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error('Erro ao salvar OS: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openOS = (os: any | null) => { setSelectedOS(os); setIsModalOpen(true); };

  const filters: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: 'Em aberto' },
    ...OS_STEPS.map(s => ({ value: s.value as StatusFilter, label: s.label })),
    { value: 'all', label: 'Todas' },
  ];

  return (
    <div className="w-full space-y-8 pb-20">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="shrink-0 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Ordens de Serviço</h1>
          <p className="hidden md:block truncate text-sm text-zinc-500 dark:text-zinc-400">Orçamentos, manutenções em andamento e faturamento da oficina.</p>
        </div>
        {canManageOS && (
          <button
            type="button"
            onClick={() => openOS(null)}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 cursor-pointer"
          >
            <Plus size={16} aria-hidden="true" />
            Nova OS
          </button>
        )}
      </div>

      {/* Resumo por etapa: clica e filtra */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statusStats.map(s => {
          const meta = STATUS_META[s.value];
          const Icon = meta.icon;
          const selected = statusFilter === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusFilter(selected ? 'all' : s.value)}
              aria-pressed={selected}
              className={`text-left p-5 bg-white dark:bg-zinc-900/90 rounded-2xl border shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selected ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-zinc-200/70 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{meta.label}</span>
                <span className={`p-1.5 rounded-lg border ${meta.badge}`}>
                  <Icon size={14} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">{s.count}</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{brl.format(s.amount)}</p>
            </button>
          );
        })}
      </div>

      {/* Busca + filtros */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 relative">
          <label htmlFor="os-search" className="sr-only">Buscar ordens de serviço</label>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} aria-hidden="true" />
          <input
            id="os-search"
            type="search"
            placeholder="Buscar por cliente, placa, modelo ou nº da OS"
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-colors"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 overflow-x-auto" role="group" aria-label="Filtrar por etapa">
          {filters.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              aria-pressed={statusFilter === f.value}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === f.value
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {f.label}
              <span className="tabular-nums text-[10px] font-bold text-zinc-400">{filterCount(f.value)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filteredOS.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredOS.map(os => {
            const status: OSStatus = (os.status as OSStatus) in STATUS_META ? os.status : 'draft';
            const meta = STATUS_META[status];
            const stepIndex = OS_STEPS.findIndex(s => s.value === status);
            const parts = (os.items || []).reduce((a: number, i: any) => a + (i.price || 0) * (i.quantity || 0), 0);
            const labor = (os.generalLaborCost || 0) + (os.items || []).reduce((a: number, i: any) => a + (i.laborCost || 0) * (i.quantity || 0), 0);
            const itemCount = (os.items || []).length;
            const wa = whatsappLink(os.customerPhone);
            return (
              <article
                key={os.id}
                onClick={() => openOS(os)}
                className="group flex flex-col bg-white dark:bg-zinc-900/90 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="px-4 pt-3.5 pb-3 space-y-2.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); openOS(os); }}
                      className="min-w-0 truncate text-left text-sm font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:underline cursor-pointer"
                    >
                      {os.customerName || 'Cliente sem nome'}
                    </button>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${meta.chip}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                      {meta.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 min-w-0 text-xs text-zinc-500 dark:text-zinc-400">
                    <PlateBadge plate={os.vehiclePlate} />
                    <span className="truncate">{os.vehicleModel || 'Modelo não informado'}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-400">#{os.id.slice(-6).toUpperCase()}</span>
                  </div>

                  {/* Etapas */}
                  <div className="grid grid-cols-4 gap-1" aria-label={`Etapa ${stepIndex + 1} de 4: ${meta.label}`} role="img">
                    {OS_STEPS.map((s, i) => (
                      <span key={s.value} className={`h-1 rounded-full ${i <= stepIndex ? meta.dot : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                    ))}
                  </div>
                </div>

                <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className="text-base font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums"
                      title={`Peças ${brl.format(parts)} · Mão de obra ${brl.format(labor)}`}
                    >
                      {brl.format(os.totalAmount || 0)}
                    </p>
                    {os.status === 'paid' && os.companyAmount != null ? (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums truncate" title={`Repasse: empresa ${os.companySharePercent}% · oficina ${100 - (os.companySharePercent ?? 0)}%`}>
                        Empresa {brl.format(os.companyAmount)} · Oficina {brl.format(os.workshopAmount ?? 0)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums truncate">
                        {formatEntry(os.scheduledDate)} · {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center shrink-0">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        aria-label={`Falar com ${os.customerName} no WhatsApp`}
                        title="WhatsApp do cliente"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                      >
                        <MessageCircle size={15} aria-hidden="true" />
                      </a>
                    )}
                    {canManageOS && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(os.id); }}
                        aria-label={`Excluir OS de ${os.customerName}`}
                        title="Excluir OS"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center py-16 px-6 bg-white dark:bg-zinc-900/90 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
          <span className="p-3 rounded-xl border bg-zinc-50 dark:bg-zinc-800 border-zinc-200/70 dark:border-zinc-700 text-zinc-400">
            <FileText size={22} aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-semibold text-zinc-900 dark:text-white">
            {searchTerm ? 'Nenhuma OS encontrada' : allOS.length === 0 ? 'Nenhuma ordem de serviço ainda' : 'Nada nesta etapa'}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
            {searchTerm
              ? 'Confira a grafia ou busque pela placa.'
              : allOS.length === 0
                ? 'Abra a primeira OS para começar a acompanhar a oficina.'
                : 'Troque o filtro para ver as outras etapas.'}
          </p>
          {canManageOS && allOS.length === 0 && (
            <button
              type="button"
              onClick={() => openOS(null)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
            >
              <Plus size={16} aria-hidden="true" /> Nova OS
            </button>
          )}
        </div>
      )}

      {/* Ficha da OS */}
      <AnimatePresence>
        {isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-950/60 backdrop-blur-sm sm:p-6"
            onMouseDown={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="os-dialog-title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex h-[100dvh] sm:h-auto sm:max-h-[min(860px,calc(100dvh-3rem))] w-full max-w-4xl flex-col overflow-hidden bg-white dark:bg-zinc-900 sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl"
            >
              {/* Cabeçalho: número da OS + etapa */}
              <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 pt-5 pb-4 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      OS {selectedOS?.id ? `#${selectedOS.id.slice(-6).toUpperCase()}` : '· rascunho'}
                    </p>
                    <h3 id="os-dialog-title" className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                      {selectedOS ? (customerName || 'Ordem de serviço') : 'Nova ordem de serviço'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    aria-label="Fechar"
                    className="-mr-2 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div role="radiogroup" aria-label="Etapa da ordem de serviço" className="mt-4 grid grid-cols-4 gap-1.5">
                  {OS_STEPS.map((step, i) => {
                    const current = OS_STEPS.findIndex(s => s.value === osStatus);
                    const reached = i <= current;
                    return (
                      <button
                        key={step.value}
                        type="button"
                        role="radio"
                        aria-checked={osStatus === step.value}
                        disabled={!canManageOS}
                        onClick={() => setOsStatus(step.value)}
                        className="group text-left focus-visible:outline-none disabled:cursor-default"
                      >
                        <span className={`block h-1 rounded-full transition-colors ${reached ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'} group-focus-visible:ring-2 group-focus-visible:ring-blue-600 group-focus-visible:ring-offset-2 dark:group-focus-visible:ring-offset-zinc-900`} />
                        <span className={`mt-1.5 block truncate text-xs ${osStatus === step.value ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'} ${canManageOS ? 'group-hover:text-zinc-900 dark:group-hover:text-white' : ''}`}>
                          {step.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {osStatus === 'paid' && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Repasse do pagamento</p>
                    <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <label htmlFor="os-company-share">Empresa</label>
                      <div className="relative">
                        <input
                          id="os-company-share"
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          inputMode="decimal"
                          value={companyPct}
                          onChange={e => setCompanyPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                          disabled={!canManageOS}
                          className="w-20 rounded-md border border-zinc-200 bg-white py-1 pl-2 pr-6 text-right font-mono text-sm tabular-nums text-zinc-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-400">%</span>
                      </div>
                      <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">{brl.format(split.companyAmount)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <span>Oficina</span>
                      <span className="font-mono text-xs text-zinc-500">{(100 - companyPct).toLocaleString('pt-BR')}%</span>
                      <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">{brl.format(split.workshopAmount)}</span>
                    </div>
                    {selectedOS?.paidAt && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:ml-auto">
                        Pago em {new Date(selectedOS.paidAt).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                )}
              </header>

              <div role="tablist" aria-label="Seções da OS" className="flex gap-6 border-b border-zinc-200 dark:border-zinc-800 px-6 sm:px-8">
                {([['client', 'Cliente e veículo'], ['items', 'Peças e serviços']] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activeModalTab === tab}
                    onClick={() => setActiveModalTab(tab)}
                    className={`relative -mb-px flex items-center gap-2 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:text-blue-600 ${activeModalTab === tab ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                  >
                    {label}
                    {tab === 'items' && items.length > 0 && (
                      <span className="rounded bg-zinc-100 px-1.5 py-px font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{items.length}</span>
                    )}
                    {activeModalTab === tab && <motion.span layoutId="os-tab-underline" className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
                {activeModalTab === 'client' ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-0">
                      <section aria-labelledby="os-client-heading" className="space-y-4 md:pr-8">
                        <h4 id="os-client-heading" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <User size={14} aria-hidden="true" /> Cliente
                        </h4>
                        <Field id="os-customer-name" label="Nome">
                          <input
                            id="os-customer-name"
                            className={fieldClass}
                            value={customerName}
                            onChange={e => setCustomerName(e.target.value)}
                            placeholder="Nome do proprietário"
                            autoComplete="off"
                            autoFocus={!selectedOS}
                            disabled={!canManageOS}
                            required
                          />
                        </Field>
                        <Field id="os-customer-phone" label="Telefone" hint="WhatsApp">
                          <input
                            id="os-customer-phone"
                            type="tel"
                            inputMode="tel"
                            className={`${fieldClass} font-mono`}
                            value={customerPhone}
                            onChange={e => setCustomerPhone(e.target.value)}
                            placeholder="(11) 98765-4321"
                            disabled={!canManageOS}
                          />
                        </Field>
                      </section>

                      <section aria-labelledby="os-vehicle-heading" className="space-y-4 md:border-l md:border-zinc-200 md:pl-8 dark:md:border-zinc-800">
                        <h4 id="os-vehicle-heading" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <Car size={14} aria-hidden="true" /> Veículo
                        </h4>
                        <Field id="os-vehicle-plate" label="Placa">
                          <PlateInput id="os-vehicle-plate" value={vehiclePlate} onChange={setVehiclePlate} disabled={!canManageOS} />
                        </Field>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field id="os-vehicle-model" label="Marca e modelo">
                            <input
                              id="os-vehicle-model"
                              className={fieldClass}
                              value={vehicleModel}
                              onChange={e => setVehicleModel(e.target.value)}
                              placeholder="Jeep Compass 2.0"
                              disabled={!canManageOS}
                            />
                          </Field>
                          <Field id="os-scheduled-date" label="Entrada">
                            <input
                              id="os-scheduled-date"
                              type="datetime-local"
                              className={`${fieldClass} font-mono text-sm`}
                              value={scheduledDate}
                              onChange={e => setScheduledDate(e.target.value)}
                              disabled={!canManageOS}
                            />
                          </Field>
                        </div>
                      </section>
                    </div>

                    <Field id="os-observations" label="Relato e diagnóstico" hint="o que o cliente contou e o que foi encontrado">
                      <textarea
                        id="os-observations"
                        className={`${fieldClass} h-32 resize-y leading-relaxed`}
                        value={observations}
                        onChange={e => setObservations(e.target.value)}
                        placeholder="Ex.: barulho na suspensão dianteira ao passar em lombada; bucha da bandeja esquerda com folga."
                        disabled={!canManageOS}
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {canManageOS && (
                      <div className="relative">
                        <label htmlFor="os-product-search" className="sr-only">Adicionar peça do estoque</label>
                        <SearchIcon size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                          id="os-product-search"
                          placeholder="Adicionar peça do estoque: nome ou SKU"
                          className={`${fieldClass} pl-10`}
                          value={productSearch}
                          onChange={e => { setProductSearch(e.target.value); setIsProductDropdownOpen(true); }}
                          onFocus={() => setIsProductDropdownOpen(true)}
                          autoComplete="off"
                        />
                        {isProductDropdownOpen && productSearch && (
                          <div className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                            {(() => {
                              const q = productSearch.toLowerCase();
                              const results = (products || []).filter(p => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 6);
                              if (!results.length) return <p className="px-4 py-3 text-sm text-zinc-500">Nenhuma peça encontrada.</p>;
                              return results.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => { handleAddItem(p); setProductSearch(''); setIsProductDropdownOpen(false); }}
                                  className="flex w-full items-center justify-between gap-4 border-b border-zinc-100 px-4 py-2.5 text-left last:border-0 hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none dark:border-zinc-800 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.name}</span>
                                    <span className="font-mono text-[11px] text-zinc-500">{p.sku || 'sem SKU'} · {p.quantity} em estoque</span>
                                  </span>
                                  <span className="shrink-0 font-mono text-sm text-zinc-700 dark:text-zinc-300">{brl.format(p.price || 0)}</span>
                                </button>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                          <tr>
                            <th scope="col" className="px-4 py-2.5 font-medium">Item</th>
                            <th scope="col" className="px-4 py-2.5 text-center font-medium">Qtd.</th>
                            <th scope="col" className="px-4 py-2.5 text-right font-medium">Peça</th>
                            <th scope="col" className="px-4 py-2.5 text-right font-medium">Mão de obra</th>
                            <th scope="col" className="px-4 py-2.5 text-right font-medium">Subtotal</th>
                            {canManageOS && <th scope="col" className="w-10 px-2"><span className="sr-only">Remover</span></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {items.map(item => (
                            <tr key={item.productId}>
                              <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{item.name}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center justify-center gap-1">
                                  {canManageOS && (
                                    <button type="button" aria-label={`Diminuir ${item.name}`} disabled={item.quantity <= 1} onClick={() => handleUpdateItemQuantity(item.productId, item.quantity - 1)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"><MinusCircle size={16} /></button>
                                  )}
                                  <span className="w-7 text-center font-mono tabular-nums">{item.quantity}</span>
                                  {canManageOS && (
                                    <button type="button" aria-label={`Aumentar ${item.name}`} onClick={() => handleUpdateItemQuantity(item.productId, item.quantity + 1)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"><PlusCircle size={16} /></button>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">{brl.format(item.price)}</td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">{brl.format(item.laborCost)}</td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{brl.format(item.total)}</td>
                              {canManageOS && (
                                <td className="px-2 py-2.5 text-right">
                                  <button type="button" aria-label={`Remover ${item.name}`} onClick={() => handleRemoveItem(item.productId)} className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={16} /></button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {items.length === 0 && (
                        <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
                          <Package size={22} aria-hidden="true" className="text-zinc-300 dark:text-zinc-600" />
                          <p className="text-sm text-zinc-500">Nenhuma peça lançada ainda.</p>
                          {canManageOS && <p className="text-xs text-zinc-400">Use a busca acima para adicionar do estoque.</p>}
                        </div>
                      )}
                    </div>

                    {/* Fechamento em formato de recibo */}
                    <dl className="ml-auto w-full max-w-sm space-y-2 rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-800/40">
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <dt>Peças</dt><dd className="font-mono tabular-nums">{brl.format(totalParts)}</dd>
                      </div>
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <dt>Mão de obra dos itens</dt><dd className="font-mono tabular-nums">{brl.format(totalItemsLabor)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-zinc-600 dark:text-zinc-400">
                        <dt><label htmlFor="os-general-labor">Mão de obra geral</label></dt>
                        <dd className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-400">R$</span>
                          <input
                            id="os-general-labor"
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            className="w-32 rounded-md border border-zinc-200 bg-white py-1 pl-8 pr-2 text-right font-mono text-sm tabular-nums text-zinc-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            value={generalLaborCost}
                            onChange={e => setGeneralLaborCost(Math.max(0, Number(e.target.value)))}
                            disabled={!canManageOS}
                          />
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between border-t border-dashed border-zinc-300 pt-3 dark:border-zinc-600">
                        <dt className="font-semibold text-zinc-900 dark:text-white">Total</dt>
                        <dd className="font-mono text-xl font-bold tabular-nums text-zinc-900 dark:text-white">{brl.format(totalOSAmount)}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>

              <footer className="flex flex-col-reverse gap-3 border-t border-zinc-200 bg-zinc-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {!canManageOS ? (
                    'Somente leitura: seu perfil não pode editar OS.'
                  ) : (
                    <>
                      {items.length} {items.length === 1 ? 'item' : 'itens'} · total{' '}
                      <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">{brl.format(totalOSAmount)}</span>
                    </>
                  )}
                </p>
                <div className="flex gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:flex-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    {canManageOS ? 'Cancelar' : 'Fechar'}
                  </button>
                  {canManageOS && (
                    <button
                      type="button"
                      onClick={handleSaveOS}
                      disabled={isSaving}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 sm:flex-none dark:focus-visible:ring-offset-zinc-900"
                    >
                      {isSaving ? <History size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
                      {isSaving ? 'Salvando…' : selectedOS ? 'Salvar alterações' : 'Abrir OS'}
                    </button>
                  )}
                </div>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmação de exclusão */}
      <AnimatePresence>
        {deleteConfirm && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm"
            onMouseDown={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="os-delete-title"
              aria-describedby="os-delete-desc"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6"
            >
              <span className="inline-flex p-2.5 rounded-xl border bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-900/40">
                <AlertTriangle size={20} aria-hidden="true" />
              </span>
              <h3 id="os-delete-title" className="mt-4 text-lg font-bold text-zinc-900 dark:text-white">Excluir esta OS?</h3>
              <p id="os-delete-desc" className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                O registro e o valor dela saem do faturamento. Não dá para desfazer.
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await deleteServiceOrder(deleteConfirm);
                      toast.success('OS excluída.');
                      setDeleteConfirm(null);
                    } catch {
                      toast.error('Não foi possível excluir esta OS.');
                    }
                  }}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
