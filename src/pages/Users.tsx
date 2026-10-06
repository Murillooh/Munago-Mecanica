import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  ShieldCheck, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Mail, 
  Phone, 
  ShieldAlert, 
  CheckCircle2, 
  X,
  AlertTriangle,
  Clock,
  ChevronRight,
  Shield,
  Briefcase,
  Smartphone,
  Lock,
  UserPlus,
  Loader2,
  Package,
  Eye,
  SlidersHorizontal,
  FileText,
  BarChart3,
  Sparkles,
  Check
} from 'lucide-react';
import { useApp, ROLE_PRESETS, UserPermissions, UserProfile } from '../context/AppContext';
import { apiGet, apiPost } from '../lib/api';
import { toast } from 'sonner';

export const Users = () => {
  const { 
    users, 
    updateUserRole, 
    updateUserPermissions,
    updateUserRoleAndPermissions,
    approveUser,
    denyUser,
    deleteUser,
    isAdmin,
    canManageUsers
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'editor' | 'viewer'>('all');
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<any>(null);

  // Edit Permissions Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [editPermissions, setEditPermissions] = useState<UserPermissions>({
    canManageInventory: false,
    canManageOS: false,
    canManageUsers: false,
    canViewReports: true,
    canPerformTransactions: false
  });
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // New User Form State
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'editor' as 'admin' | 'editor' | 'viewer',
    canManageInventory: true,
    canManageOS: true,
    canManageUsers: false,
    canViewReports: true,
    canPerformTransactions: true
  });

  const handleRolePresetSelectForNewUser = (role: 'admin' | 'editor' | 'viewer') => {
    const preset = ROLE_PRESETS[role].permissions;
    setNewUser(prev => ({
      ...prev,
      role,
      ...preset
    }));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await apiPost('/users', {
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        permissions: {
          canManageInventory: newUser.canManageInventory,
          canManageOS: newUser.canManageOS,
          canManageUsers: newUser.canManageUsers,
          canViewReports: newUser.canViewReports,
          canPerformTransactions: newUser.canPerformTransactions
        }
      });

      toast.success('Usuário criado! O convite com a senha temporária foi enviado por e-mail.');
      setIsAddModalOpen(false);
      setNewUser({
        name: '',
        email: '',
        role: 'editor',
        canManageInventory: true,
        canManageOS: true,
        canManageUsers: false,
        canViewReports: true,
        canPerformTransactions: true
      });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar usuário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditPermissionsModal = (user: UserProfile) => {
    setEditingUser(user);
    const currentRole = user.role || 'viewer';
    setEditRole(currentRole);
    
    const userPerms = (user.permissions && Object.keys(user.permissions).length > 0)
      ? { ...user.permissions }
      : { ...ROLE_PRESETS[currentRole].permissions };

    setEditPermissions(userPerms);
  };

  const applyRolePresetInEditModal = (role: 'admin' | 'editor' | 'viewer') => {
    setEditRole(role);
    setEditPermissions({ ...ROLE_PRESETS[role].permissions });
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    setIsSavingPermissions(true);
    try {
      await updateUserRoleAndPermissions(editingUser.uid, editRole, editPermissions);
      setEditingUser(null);
    } catch (err) {
      console.error('Error saving permissions:', err);
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const isCustomizedPermissions = () => {
    const preset = ROLE_PRESETS[editRole].permissions;
    return (
      editPermissions.canManageInventory !== preset.canManageInventory ||
      editPermissions.canManageOS !== preset.canManageOS ||
      editPermissions.canManageUsers !== preset.canManageUsers ||
      editPermissions.canViewReports !== preset.canViewReports ||
      editPermissions.canPerformTransactions !== preset.canPerformTransactions
    );
  };

  useEffect(() => {
    fetchAccessRequests();
  }, []);

  const fetchAccessRequests = async () => {
    setIsLoadingRequests(true);
    try {
      setAccessRequests(await apiGet<any[]>('/access-requests?status=pending'));
    } catch (error) {
       console.error('Error fetching requests:', error);
    } finally {
       setIsLoadingRequests(false);
    }
  };

  const filteredUsers = (users || []).filter(u => {
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Admin',
          fullName: 'Administrador',
          bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          icon: ShieldCheck
        };
      case 'editor':
        return {
          label: 'Operador',
          fullName: 'Operador Logístico',
          bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          icon: Briefcase
        };
      default:
        return {
          label: 'Visualizador',
          fullName: 'Visualizador (Leitura)',
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          icon: Eye
        };
    }
  };

  return (
    <div className="space-y-10 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white tracking-widest uppercase">
            Equipe & Controle de Acesso
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold mt-1">
            Atribua funções (Admin, Operador, Visualizador) e controle permissões personalizadas.
          </p>
        </div>
        
        {canManageUsers && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-3xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus size={18} />
            Novo Usuário
          </button>
        )}
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div 
          onClick={() => setRoleFilter(roleFilter === 'admin' ? 'all' : 'admin')}
          className={`p-6 rounded-[2.5rem] border transition-all cursor-pointer ${
            roleFilter === 'admin'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-600/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-800 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-2xl ${roleFilter === 'admin' ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'}`}>
              <ShieldCheck size={24} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
              roleFilter === 'admin' ? 'bg-white text-indigo-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
            }`}>
              {(users || []).filter(u => u.role === 'admin').length} membros
            </span>
          </div>
          <h4 className="text-xl font-black uppercase tracking-tight">Admin</h4>
          <p className={`text-xs mt-1 ${roleFilter === 'admin' ? 'text-indigo-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
            Controle total: gerencia equipe, estoque, OS e configurações do sistema.
          </p>
        </div>

        <div 
          onClick={() => setRoleFilter(roleFilter === 'editor' ? 'all' : 'editor')}
          className={`p-6 rounded-[2.5rem] border transition-all cursor-pointer ${
            roleFilter === 'editor'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-600/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-2xl ${roleFilter === 'editor' ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>
              <Briefcase size={24} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
              roleFilter === 'editor' ? 'bg-white text-blue-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
            }`}>
              {(users || []).filter(u => u.role === 'editor').length} membros
            </span>
          </div>
          <h4 className="text-xl font-black uppercase tracking-tight">Operador</h4>
          <p className={`text-xs mt-1 ${roleFilter === 'editor' ? 'text-blue-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
            Rotina ativa: gerencia catálogo, movimenta entradas/saídas e atende OS.
          </p>
        </div>

        <div 
          onClick={() => setRoleFilter(roleFilter === 'viewer' ? 'all' : 'viewer')}
          className={`p-6 rounded-[2.5rem] border transition-all cursor-pointer ${
            roleFilter === 'viewer'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-600/20'
              : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-800 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-2xl ${roleFilter === 'viewer' ? 'bg-white/20 text-white' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600'}`}>
              <Eye size={24} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
              roleFilter === 'viewer' ? 'bg-white text-emerald-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
            }`}>
              {(users || []).filter(u => u.role === 'viewer').length} membros
            </span>
          </div>
          <h4 className="text-xl font-black uppercase tracking-tight">Visualizador</h4>
          <p className={`text-xs mt-1 ${roleFilter === 'viewer' ? 'text-emerald-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
            Somente leitura: consulta estoque, ordens e relatórios sem permissão de edição.
          </p>
        </div>
      </div>

      {/* Access Requests */}
      {canManageUsers && accessRequests.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
              <Clock size={20} />
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Solicitações Pendentes</h3>
            <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
              {accessRequests.length} NOVAS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {accessRequests.map(request => (
               <motion.div 
                 key={request.id}
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="bg-white dark:bg-zinc-900 border-2 border-amber-100 dark:border-amber-900/30 p-6 rounded-[2.5rem] shadow-xl relative group overflow-hidden"
               >
                 <div className="flex items-start gap-4 mb-6 relative z-10">
                   <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-600 font-black">
                     <User size={24} />
                   </div>
                   <div className="flex-1 min-w-0">
                     <h4 className="font-black text-zinc-900 dark:text-white uppercase tracking-tight truncate">{request.name}</h4>
                     <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{request.email}</p>
                   </div>
                 </div>

                 <div className="space-y-2 mb-6 relative z-10 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                   <p className="flex items-center gap-2">
                     <Shield size={14} className="text-amber-500" />
                     {request.workshopName}
                   </p>
                   {request.phone && (
                     <p className="flex items-center gap-2">
                       <Smartphone size={14} className="text-blue-500" />
                       {request.phone}
                     </p>
                   )}
                 </div>

                 <div className="flex items-center gap-2 relative z-10">
                    <button 
                      onClick={async () => {
                        const toastId = toast.loading('Processando aprovação...');
                        try {
                          await apiPost(`/access-requests/${request.id}/approve`, { role: 'editor' });
                          await fetchAccessRequests();
                          toast.success('Acesso aprovado como Operador!', { id: toastId });
                        } catch (err: any) {
                          toast.error('Erro ao aprovar: ' + err.message, { id: toastId });
                        }
                      }}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
                    >
                      Aprovar (Operador)
                    </button>
                    <button 
                      onClick={async () => {
                        const toastId = toast.loading('Negando acesso...');
                        try {
                          await apiPost(`/access-requests/${request.id}/reject`);
                          await fetchAccessRequests();
                          toast.success('Pedido rejeitado', { id: toastId });
                        } catch (err: any) {
                          toast.error('Erro ao rejeitar: ' + err.message, { id: toastId });
                        }
                      }}
                      className="p-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-red-500 rounded-2xl border border-zinc-100 dark:border-zinc-700 transition-all active:scale-95 cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                 </div>
               </motion.div>
             ))}
          </div>
        </div>
      )}

      {/* Users List & Search */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Membros da Equipe</h3>
              <p className="text-xs text-zinc-400 font-bold">
                Mostrando {filteredUsers.length} colaboradores {roleFilter !== 'all' ? `(${getRoleBadge(roleFilter).label})` : ''}
              </p>
            </div>
          </div>
          
          <div className="w-full md:w-96 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
             <input 
               type="text" 
               placeholder="Buscar por nome, e-mail ou cargo..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl py-3 pl-12 pr-6 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-sm"
             />
          </div>
        </div>

        {/* Member Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredUsers.map((user, idx) => {
            const roleBadge = getRoleBadge(user.role);
            const userPerms = user.permissions || ROLE_PRESETS[user.role || 'viewer']?.permissions;

            return (
              <motion.div 
                key={user.uid}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-8 rounded-[3rem] shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Top user row */}
                  <div className="flex items-center gap-4 mb-6 relative z-10">
                    <div className="relative group/avatar shrink-0">
                      <img 
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2563EB&color=fff&bold=true`} 
                        alt={user.name} 
                        className="w-16 h-16 rounded-[1.5rem] object-cover border border-zinc-100 dark:border-zinc-800 shadow-md group-hover/avatar:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white dark:border-zinc-900 ${user.status === 'approved' ? 'bg-green-500' : 'bg-amber-500'}`} title={user.status === 'approved' ? 'Aprovado' : 'Aguardando aprovação'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-black text-zinc-900 dark:text-white truncate uppercase tracking-tight">{user.name}</h4>
                      </div>
                      <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 truncate">{user.email}</p>
                      
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${roleBadge.bg}`}>
                          <roleBadge.icon size={12} />
                          {roleBadge.label}
                        </span>
                        {user.status === 'pending' && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-lg border border-amber-200">
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active Capabilities / Permission Badges */}
                  <div className="space-y-2 mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Permissões Habilitadas</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {userPerms?.canManageInventory && (
                        <span className="text-[9px] font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300">
                          📦 Estoque
                        </span>
                      )}
                      {userPerms?.canPerformTransactions && (
                        <span className="text-[9px] font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300">
                          🔄 Movimentação
                        </span>
                      )}
                      {userPerms?.canManageOS && (
                        <span className="text-[9px] font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300">
                          📋 Ordens de Serviço
                        </span>
                      )}
                      {userPerms?.canViewReports && (
                        <span className="text-[9px] font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300">
                          📊 Relatórios
                        </span>
                      )}
                      {userPerms?.canManageUsers && (
                        <span className="text-[9px] font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-indigo-600 dark:text-indigo-400 font-black">
                          🛡️ Gerir Equipe
                        </span>
                      )}
                      {!userPerms?.canManageInventory && !userPerms?.canPerformTransactions && !userPerms?.canManageOS && (
                        <span className="text-[9px] font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-emerald-600 dark:text-emerald-400">
                          👁️ Apenas Consulta
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Toolbar */}
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-50 dark:border-zinc-800">
                  {canManageUsers && (
                    <button
                      onClick={() => openEditPermissionsModal(user)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest py-3 px-4 rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <SlidersHorizontal size={14} />
                      Editar Acessos
                    </button>
                  )}

                  {isAdmin && user.status === 'pending' && (
                    <button
                      onClick={async () => {
                        const toastId = toast.loading('Aprovando...');
                        try {
                          await approveUser(user.uid);
                          toast.success('Usuário aprovado com sucesso!', { id: toastId });
                        } catch (err: any) {
                          toast.error('Erro ao aprovar.', { id: toastId });
                        }
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase tracking-widest py-3 px-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                      title="Aprovar usuário pendente"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}

                  {isAdmin && user.uid !== 'system' && (
                    <button 
                      onClick={() => setDeleteConfirmUser(user)}
                      className="p-3 bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all active:scale-95 border border-red-100 dark:border-red-900/20 cursor-pointer"
                      title="Excluir usuário"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredUsers.length === 0 && (
          <div className="p-16 text-center bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 text-zinc-400">
            <p className="font-black text-sm uppercase tracking-widest">Nenhum membro encontrado</p>
            <p className="text-xs font-bold mt-1">Tente ajustar o termo de pesquisa ou os filtros de cargo.</p>
          </div>
        )}
      </div>

      {/* Modal - Editar Permissões & Nível de Acesso */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden border border-zinc-100 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-8 pb-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/30">
                    <SlidersHorizontal size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                      Atribuir Permissões
                    </h3>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                      Configuração de Perfil: <span className="text-blue-600 dark:text-blue-400 font-black">{editingUser.name}</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingUser(null)}
                  className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-2xl transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content Scrollable */}
              <div className="p-8 space-y-8 overflow-y-auto flex-1">
                {/* 1. Escolha de Perfil Base (Preset) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      1. Função Base / Nível de Acesso
                    </label>
                    {isCustomizedPermissions() ? (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
                        ⚡ Permissões Personalizadas
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800">
                        ✓ Perfil Padrão
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(['admin', 'editor', 'viewer'] as const).map(roleKey => {
                      const isSelected = editRole === roleKey;
                      const preset = ROLE_PRESETS[roleKey];
                      const Icon = roleKey === 'admin' ? ShieldCheck : roleKey === 'editor' ? Briefcase : Eye;

                      return (
                        <button
                          key={roleKey}
                          type="button"
                          onClick={() => applyRolePresetInEditModal(roleKey)}
                          className={`p-5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-600 shadow-md ring-2 ring-blue-600/20'
                              : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 hover:border-zinc-400'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-white dark:bg-zinc-800 text-zinc-500'}`}>
                                <Icon size={18} />
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              )}
                            </div>
                            <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                              {roleKey === 'admin' ? 'Admin' : roleKey === 'editor' ? 'Operador' : 'Visualizador'}
                            </h4>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                              {roleKey === 'admin' ? 'Acesso total irrestrito' : roleKey === 'editor' ? 'Estoque e Ordens de Serviço' : 'Somente Leitura e Relatórios'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Permissões Granulares */}
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">
                    2. Ajuste Fino de Permissões Granulares
                  </label>

                  <div className="space-y-3">
                    {[
                      { 
                        id: 'canManageInventory', 
                        label: 'Gerenciar Estoque (Catálogo)', 
                        description: 'Cadastrar novos itens, alterar preços/dados e excluir peças.',
                        icon: Package 
                      },
                      { 
                        id: 'canPerformTransactions', 
                        label: 'Movimentar Estoque', 
                        description: 'Registrar entradas de reposição e saídas manuais com justificativa.',
                        icon: ChevronRight 
                      },
                      { 
                        id: 'canManageOS', 
                        label: 'Ordens de Serviço (OS)', 
                        description: 'Gerar novas ordens de serviço, associar peças e alterar status de manutenção.',
                        icon: Briefcase 
                      },
                      { 
                        id: 'canViewReports', 
                        label: 'Relatórios & Monitoramento', 
                        description: 'Acessar indicadores, tendências de 7 dias e exportar relatórios em PDF/Excel.',
                        icon: BarChart3 
                      },
                      { 
                        id: 'canManageUsers', 
                        label: 'Gestão de Usuários e Equipe', 
                        description: 'Aprovar novos cadastros, alterar cargos e permissões de outros colaboradores.',
                        icon: Shield 
                      }
                    ].map(perm => {
                      const isChecked = Boolean(editPermissions[perm.id as keyof UserPermissions]);

                      return (
                        <label 
                          key={perm.id}
                          className={`flex items-start justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50/30 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900/40'
                              : 'bg-zinc-50/60 dark:bg-zinc-800/30 border-zinc-100 dark:border-zinc-800'
                          }`}
                        >
                          <div className="flex items-start gap-3.5 pr-4">
                            <div className={`p-2.5 rounded-xl shrink-0 ${isChecked ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'}`}>
                              <perm.icon size={18} />
                            </div>
                            <div>
                              <span className="text-xs font-black uppercase text-zinc-900 dark:text-white tracking-tight">
                                {perm.label}
                              </span>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                                {perm.description}
                              </p>
                            </div>
                          </div>

                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => setEditPermissions({
                              ...editPermissions,
                              [perm.id]: e.target.checked
                            })}
                            className="w-5 h-5 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-600/20 cursor-pointer mt-1"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3 bg-zinc-50/50 dark:bg-zinc-800/20">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-6 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-600 dark:text-zinc-300 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSavingPermissions}
                  onClick={handleSavePermissions}
                  className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSavingPermissions ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Salvar Permissões
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal - Novo Usuário */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden border border-zinc-100 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-8 pb-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Novo Colaborador</h3>
                    <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Defina o cargo e permissões</p>
                  </div>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 rounded-2xl transition-all cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="p-8 space-y-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input 
                      type="text"
                      value={newUser.name}
                      onChange={e => setNewUser({...newUser, name: e.target.value})}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl py-3.5 px-5 text-sm font-bold dark:text-white outline-none focus:ring-4 focus:ring-blue-600/10 transition-all"
                      placeholder="Ex: Carlos Oliveira"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Endereço de E-mail</label>
                    <input 
                      type="email"
                      value={newUser.email}
                      onChange={e => setNewUser({...newUser, email: e.target.value})}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl py-3.5 px-5 text-sm font-bold dark:text-white outline-none focus:ring-4 focus:ring-blue-600/10 transition-all"
                      placeholder="colaborador@munago.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Função / Cargo</label>
                  <select 
                    value={newUser.role}
                    onChange={e => handleRolePresetSelectForNewUser(e.target.value as any)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl py-3.5 px-5 text-sm font-bold dark:text-white outline-none focus:ring-4 focus:ring-blue-600/10 cursor-pointer"
                  >
                    <option value="admin">Admin (Administrador - Controle Total)</option>
                    <option value="editor">Operador (Estoque, Movimentações e OS)</option>
                    <option value="viewer">Visualizador (Somente Leitura e Relatórios)</option>
                  </select>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                    Permissões Atribuídas ao Usuário
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[ 
                      { id: 'canManageInventory', label: 'Gerir Estoque', icon: Package },
                      { id: 'canPerformTransactions', label: 'Movimentar Itens', icon: ChevronRight },
                      { id: 'canManageOS', label: 'Ordens de Serviço', icon: Briefcase },
                      { id: 'canViewReports', label: 'Ver Relatórios', icon: BarChart3 },
                      { id: 'canManageUsers', label: 'Gerir Equipe', icon: Shield }
                    ].map(perm => (
                      <label key={perm.id} className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-all border border-zinc-100 dark:border-zinc-700/50">
                        <div className="flex items-center gap-2.5">
                          <perm.icon size={16} className="text-zinc-400" />
                          <span className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-300 tracking-tight">{perm.label}</span>
                        </div>
                        <input 
                          type="checkbox"
                          checked={(newUser as any)[perm.id]}
                          onChange={e => setNewUser({...newUser, [perm.id]: e.target.checked})}
                          className="w-5 h-5 rounded-lg border-2 border-zinc-200 dark:border-zinc-600 text-blue-600 focus:ring-blue-600/10 cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} />
                        Concluir e Cadastrar Usuário
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete User Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmUser && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-8 border border-zinc-100 dark:border-zinc-800 shadow-2xl relative overflow-hidden"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">Excluir Usuário?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8">
                Tem certeza que deseja excluir o perfil de <strong className="text-zinc-900 dark:text-white uppercase">{deleteConfirmUser.name}</strong>? Esta ação revogará imediatamente o acesso deste usuário.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmUser(null)}
                  className="flex-1 px-4 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                     try {
                       await deleteUser(deleteConfirmUser.uid);
                       setDeleteConfirmUser(null);
                     } catch (err) {
                       console.error('Erro ao excluir:', err);
                     }
                  }}
                  className="flex-[2] px-4 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-red-600/30 active:scale-95 cursor-pointer"
                >
                  Excluir Permanentemente
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
