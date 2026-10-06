import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Calendar, 
  User, 
  Car, 
  Wrench, 
  Save, 
  X, 
  CheckCircle2, 
  Printer, 
  MessageCircle, 
  History,
  ChevronRight,
  Filter,
  DollarSign,
  Package,
  PlusCircle,
  MinusCircle,
  Search as SearchIcon,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';

export const ServiceOrders = () => {
  const { 
    serviceOrders, 
    products, 
    addServiceOrder, 
    updateServiceOrder, 
    deleteServiceOrder, 
    canManageOS,
    profile 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOS, setSelectedOS] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'paid'>('active');
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
  const [osStatus, setOsStatus] = useState<'draft' | 'in_progress' | 'completed' | 'paid'>('draft');
  const [observations, setObservations] = useState('');
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
    }
    setActiveModalTab('client');
  }, [selectedOS, isModalOpen]);

  const totalParts = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const totalItemsLabor = items.reduce((acc, i) => acc + (i.laborCost * i.quantity), 0);
  const totalOSLabor = totalItemsLabor + generalLaborCost;
  const totalOSAmount = totalParts + totalOSLabor;

  const filteredOS = (serviceOrders || []).filter(os => {
    const matchesSearch = os.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.vehiclePlate?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'active') return matchesSearch && (os.status === 'draft' || os.status === 'in_progress');
    if (statusFilter === 'completed') return matchesSearch && os.status === 'completed';
    if (statusFilter === 'paid') return matchesSearch && os.status === 'paid';
    return matchesSearch;
  });

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'in_progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
    }
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase">Ordens de Serviço</h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold mt-1">Gerencie manutenções, clientes e faturamento da oficina.</p>
        </div>
        <div className="flex items-center gap-3">
          {canManageOS && (
            <button 
              onClick={() => { setSelectedOS(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-8 py-3.5 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-95"
            >
              <Plus size={18} />
              Gerar Nova OS
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-5 top-1/2 -track-y-1/2 text-zinc-400 -translate-y-1/2" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por cliente, placa ou detalhes..." 
            className="w-full pl-14 pr-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          {['all', 'active', 'completed', 'paid'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === status ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              {status === 'all' ? 'Ver Tudo' : status === 'active' ? 'Em Aberto' : status === 'completed' ? 'Concluído' : 'Pago'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence>
          {filteredOS.map((os, idx) => (
            <motion.div 
              key={os.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-8 rounded-[3rem] shadow-xl hover:shadow-2xl transition-all group cursor-pointer relative overflow-hidden"
              onClick={() => { setSelectedOS(os); setIsModalOpen(true); }}
            >
              <div className="absolute top-0 right-0 p-8 text-blue-600/5 group-hover:scale-110 transition-transform">
                <FileText size={120} />
              </div>

              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${getStatusColor(os.status)} shadow-sm`}>
                  {os.status}
                </div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{os.scheduledDate?.slice(0, 10)}</p>
              </div>

              <div className="mb-6 relative z-10">
                <h4 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight truncate group-hover:text-blue-600 transition-colors uppercase">{os.customerName}</h4>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                    <Car size={14} className="text-blue-600" />
                    {os.vehiclePlate || 'S/ PLACA'}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 uppercase">
                    <Wrench size={14} />
                    {os.vehicleModel || 'Modelo'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 pt-6 border-t border-zinc-50 dark:border-zinc-800">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Total Peças</p>
                  <p className="text-lg font-black text-zinc-900 dark:text-white tabular-nums">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(os.items?.reduce((a:any, b:any)=>a+(b.price*b.quantity), 0) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Mão de Obra</p>
                  <p className="text-lg font-black text-zinc-900 dark:text-white tabular-nums">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((os.generalLaborCost || 0) + (os.items?.reduce((a:any, b:any)=>a+(b.laborCost*b.quantity), 0) || 0))}
                  </p>
                </div>
              </div>

              {os.items && os.items.length > 0 && (
                <div className="mb-8 pt-4 border-t border-dashed border-zinc-100 dark:border-zinc-800 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Itens Inclusos</p>
                  {os.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-start text-xs border-b border-zinc-50 dark:border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex-1 pr-2">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300 uppercase block mb-0.5">
                          {item.quantity}x {item.name}
                        </span>
                        <div className="text-[9px] text-zinc-400 font-medium tracking-wide">
                          Peça: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)} <span className="mx-1 text-zinc-300">|</span> 
                          M.O: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.laborCost)}
                        </div>
                      </div>
                      <div className="text-right pl-2">
                         <div className="font-black text-blue-600 mb-0.5">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((item.price + item.laborCost) * item.quantity)}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-6 border-t border-zinc-50 dark:border-zinc-800">
                 <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-blue-600 mb-1">Faturamento Total</p>
                    <p className="text-3xl font-black text-blue-600 tabular-nums tracking-tighter">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(os.totalAmount || 0)}
                    </p>
                 </div>
                 <div className="flex gap-2">
                    <button className="p-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-blue-600 rounded-2xl transition-all shadow-sm">
                      <Printer size={18} />
                    </button>
                    {canManageOS && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(os.id); }}
                        className="p-3 bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                 </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal - Large Side Drawer Style or Centered */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-zinc-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-5xl h-full sm:h-auto sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-3xl flex items-center justify-center shadow-xl">
                    <FileText size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                      {selectedOS ? 'Auditoria de OS' : 'Gerar Ordem de Serviço'}
                    </h3>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">ID: {selectedOS?.id?.slice(-6) || 'NOVA'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-4 bg-white dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 rounded-3xl transition-all shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <button 
                  onClick={() => setActiveModalTab('client')}
                  className={`flex-1 py-6 text-xs font-black uppercase tracking-widest relative ${activeModalTab === 'client' ? 'text-blue-600' : 'text-zinc-400'}`}
                >
                  Módulo Cliente & Veículo
                  {activeModalTab === 'client' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-10 right-10 h-1 bg-blue-600 rounded-full" />}
                </button>
                <button 
                  onClick={() => setActiveModalTab('items')}
                  className={`flex-1 py-6 text-xs font-black uppercase tracking-widest relative ${activeModalTab === 'items' ? 'text-blue-600' : 'text-zinc-400'}`}
                >
                  Lista de Peças & Serviços
                  {activeModalTab === 'items' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-10 right-10 h-1 bg-blue-600 rounded-full" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 bg-zinc-50/30 dark:bg-zinc-900/30">
                 {activeModalTab === 'client' ? (
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="space-y-8">
                        <div className="flex items-center gap-3">
                          <User size={18} className="text-blue-600" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Proprietário</h4>
                        </div>
                        <div className="space-y-6">
                           <div className="space-y-1.5">
                              <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome Completo</label>
                              <input 
                                className="w-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl p-5 text-zinc-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-sm"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                placeholder="Ex: Rodrigo Albuquerque"
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                              <input 
                                className="w-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl p-5 text-zinc-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-sm"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                placeholder="(00) 00000-0000"
                              />
                           </div>
                        </div>
                      </div>

                      <div className="space-y-8">
                        <div className="flex items-center gap-3">
                          <Car size={18} className="text-indigo-600" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Automóvel</h4>
                        </div>
                        <div className="space-y-6">
                           <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Marca / Modelo</label>
                                <input 
                                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl p-5 text-zinc-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-sm"
                                  value={vehicleModel}
                                  onChange={e => setVehicleModel(e.target.value)}
                                  placeholder="Ex: Jeep Compass"
                                />
                             </div>
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Placa</label>
                                <input 
                                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl p-5 text-zinc-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-sm uppercase tabular-nums"
                                  value={vehiclePlate}
                                  onChange={e => setVehiclePlate(e.target.value)}
                                  placeholder="ABC-1234"
                                />
                             </div>
                           </div>
                           <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Entrada</label>
                                <input 
                                  type="datetime-local"
                                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl p-5 text-zinc-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-sm"
                                  value={scheduledDate}
                                  onChange={e => setScheduledDate(e.target.value)}
                                />
                             </div>
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Status do Processo</label>
                                <select 
                                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl p-5 text-zinc-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-sm cursor-pointer"
                                  value={osStatus}
                                  onChange={e => setOsStatus(e.target.value as any)}
                                >
                                  <option value="draft">Análise / Rascunho</option>
                                  <option value="in_progress">Em Manutenção</option>
                                  <option value="completed">Aguardando Retirada</option>
                                  <option value="paid">Finalizado & Pago</option>
                                </select>
                             </div>
                           </div>
                        </div>
                      </div>

                      <div className="lg:col-span-2 space-y-4">
                        <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Observações Premium</label>
                        <textarea 
                          className="w-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-[2.5rem] p-8 text-zinc-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-inner resize-none h-40"
                          value={observations}
                          onChange={e => setObservations(e.target.value)}
                          placeholder="Descreva problemas relatados, diagnósticos iniciais ou detalhes técnicos..."
                        />
                      </div>
                   </div>
                 ) : (
                   <div className="space-y-10">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 relative">
                          <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={24} />
                          <input 
                            placeholder="Buscar produto no estoque..." 
                            className="w-full pl-16 pr-8 py-6 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-[2.5rem] font-bold text-lg outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 shadow-xl"
                            value={productSearch}
                            onChange={e => { setProductSearch(e.target.value); setIsProductDropdownOpen(true); }}
                            onFocus={() => setIsProductDropdownOpen(true)}
                          />
                          <AnimatePresence>
                            {isProductDropdownOpen && productSearch && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute left-0 right-0 top-full mt-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2rem] shadow-2xl z-50 overflow-hidden"
                              >
                                {(products || []).filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5).map(p => (
                                  <button
                                    key={p.id}
                                    onClick={() => { handleAddItem(p); setProductSearch(''); setIsProductDropdownOpen(false); }}
                                    className="w-full p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-50 dark:border-zinc-800 last:border-0"
                                  >
                                    <div className="text-left">
                                      <p className="font-black text-zinc-900 dark:text-white uppercase tracking-tight">{p.name}</p>
                                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{p.sku || 'S/ SKU'}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-lg font-black text-blue-600 tabular-nums">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price)}
                                      </p>
                                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Saldo: {p.quantity}</p>
                                    </div>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="bg-white dark:bg-zinc-800 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-700 shadow-xl flex items-center gap-10">
                           <div className="text-center">
                              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Peças</p>
                              <p className="text-2xl font-black text-zinc-900 dark:text-white tabular-nums">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalParts)}
                              </p>
                           </div>
                           <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-700" />
                           <div className="text-center">
                              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Mão de Obra</p>
                              <p className="text-2xl font-black text-zinc-900 dark:text-white tabular-nums">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalOSLabor)}
                              </p>
                           </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-xl overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-700 text-left">
                              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Item Selecionado</th>
                              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center">Quantidade</th>
                              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Valor Unit.</th>
                              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">M.O Unit.</th>
                              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Subtotal</th>
                              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                            {(items || []).map(item => (
                              <tr key={item.productId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-all group">
                                <td className="px-8 py-6">
                                  <p className="font-black text-zinc-900 dark:text-white uppercase tracking-tight">{item.name}</p>
                                </td>
                                <td className="px-8 py-6">
                                  <div className="flex items-center justify-center gap-4">
                                    <button onClick={() => handleUpdateItemQuantity(item.productId, item.quantity - 1)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-all"><MinusCircle size={18} /></button>
                                    <span className="text-xl font-black tabular-nums">{item.quantity}</span>
                                    <button onClick={() => handleUpdateItemQuantity(item.productId, item.quantity + 1)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-blue-50 text-zinc-400 hover:text-blue-600 transition-all"><PlusCircle size={18} /></button>
                                  </div>
                                </td>
                                <td className="px-8 py-6">
                                  <p className="font-bold text-zinc-600 dark:text-zinc-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</p>
                                </td>
                                <td className="px-8 py-6 font-bold text-zinc-600 dark:text-zinc-400">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.laborCost)}
                                </td>
                                <td className="px-8 py-6 text-right">
                                  <p className="font-black text-blue-600 tabular-nums">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total)}
                                  </p>
                                </td>
                                <td className="px-8 py-6 text-right">
                                  <button onClick={() => handleRemoveItem(item.productId)} className="p-3 text-zinc-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={20} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {items.length === 0 && (
                          <div className="p-20 text-center text-zinc-300 italic uppercase font-black text-xs tracking-widest opacity-30">
                            Nenhum item adicionado à ordem.
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col md:flex-row gap-8 items-end justify-between bg-zinc-900 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-10 text-white/5">
                           <DollarSign size={200} />
                         </div>
                         <div className="space-y-2 relative z-10">
                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Mão de Obra de Reparo Geral</label>
                            <input 
                              type="number"
                              className="bg-transparent text-5xl font-black text-white outline-none w-64 border-b-2 border-white/10 focus:border-blue-500 transition-colors"
                              value={generalLaborCost}
                              onChange={e => setGeneralLaborCost(Number(e.target.value))}
                            />
                            <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest">Valor adicional de diagnóstico ou serviço principal</p>
                         </div>
                         <div className="text-right relative z-10">
                            <p className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-1">Total Geral da Auditoria</p>
                            <p className="text-6xl font-black text-white tabular-nums tracking-tighter">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalOSAmount)}
                            </p>
                         </div>
                      </div>
                   </div>
                 )}
              </div>

              <div className="p-8 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)]">
                <div>
                  {!canManageOS && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      Modo Somente Leitura
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-8 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-zinc-100 transition-all border border-zinc-100 dark:border-zinc-700"
                  >
                    {canManageOS ? 'Descartar Alterações' : 'Fechar'}
                  </button>
                  {canManageOS && (
                    <button 
                      onClick={handleSaveOS}
                      disabled={isSaving}
                      className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all shadow-xl shadow-blue-600/30 active:scale-95 disabled:opacity-50 flex items-center gap-3"
                    >
                      {isSaving ? <History size={18} className="animate-spin" /> : <Save size={18} />}
                      {selectedOS ? 'Atualizar OS' : 'Gerar & Registrar'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] shadow-2xl max-w-sm w-full text-center border border-zinc-100 dark:border-zinc-800"
            >
              <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Trash2 size={36} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">Excluir OS?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 font-bold mb-8 leading-relaxed">Esta ação é irreversível e removerá o registro financeiro desta ordem.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-6 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                     try {
                       await deleteServiceOrder(deleteConfirm);
                       toast.success('Serviço removido!');
                       setDeleteConfirm(null);
                     } catch (err) {
                       toast.error('Vínculo ativo: Não foi possível excluir.');
                     }
                  }}
                  className="flex-1 px-6 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all shadow-xl shadow-red-500/20"
                >
                  Excluir Permanente
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
