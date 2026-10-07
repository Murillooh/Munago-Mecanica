import { toast } from 'sonner';
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { createBackupFile, listBackups, getFileContent } from '../lib/googleDrive';
import {
  applyAccentColorToDOM,
  getStoredAccentColor,
  ThemePreference,
  getStoredThemePreference,
  resolveEffectiveTheme,
  applyThemeToDOM,
  LOCAL_STORAGE_THEME_KEY
} from '../lib/theme';
import {
  playLowStockAlertIfEnabled,
  getStoredSoundAlertsEnabled,
  setStoredSoundAlertsEnabled,
  soundManager
} from '../lib/audioAlert';
import {
  login as cognitoLogin,
  logout as cognitoLogout,
  completeNewPassword as cognitoCompleteNewPassword,
  getIdToken,
  isOAuthReturn,
  type LoginResult,
} from '../lib/auth';
import { Hub } from 'aws-amplify/utils';
import { apiGet, apiPost, apiPatch, apiDelete, hydrateDates, subscribeChanges, ApiRequestError } from '../lib/api';
import { useGoogleAuth, fetchGoogleAccessToken } from '../hooks/useGoogleAuth';

// Types
export interface Product {
  id: string;
  sku?: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  laborCost?: number;
  quantity: number;
  minQuantity: number;
  status: 'ativo' | 'inativo';
  imageUrl?: string;
  observation?: string;
  expirationDate?: string;
  batch?: string;
  supplier?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Transaction {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out';
  quantity: number;
  reason?: string;
  timestamp: any;
  userId: string;
  userName: string;
}

export interface UserPermissions {
  canManageInventory: boolean;
  canManageOS: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canPerformTransactions: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  photoURL?: string;
  permissions?: UserPermissions;
  status: 'pending' | 'approved' | 'denied';
  createdAt?: any;
}

/** Usuário autenticado (Cognito). Mesmos nomes de campo que as telas usavam do Firebase. */
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  productId?: string;
  type: 'low_stock';
  timestamp: any;
  read: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  aiSuggestion?: string;
  createdAt: any;
}

export interface SystemSettings {
  storeName: string;
  logoUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  allowNegativeStock: boolean;
  accentColor: string;
  autoBackupEnabled: boolean;
  enableSoundAlerts?: boolean;
  monitorAutoScrollEnabled?: boolean;
  monitorScrollIntervalSeconds?: number;
  /** % do total da OS que vai para a empresa no pagamento (o resto é da oficina). */
  companySharePercent?: number;
  lastFirestoreBackup?: string;
}

export interface ServiceOrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  laborCost: number;
  total: number;
  observation?: string;
}

export interface ServiceOrder {
  id: string;
  customerName: string;
  customerPhone?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  items: ServiceOrderItem[];
  generalLaborCost: number;
  totalLaborCost: number;
  totalPartsCost: number;
  totalAmount: number;
  status: 'draft' | 'in_progress' | 'completed' | 'paid';
  scheduledDate: string;
  completionDate?: string;
  observations?: string;
  /** Repasse congelado pelo servidor quando a OS fica 'paid'. Na escrita, só companySharePercent é aceito. */
  companySharePercent?: number | null;
  companyAmount?: number | null;
  workshopAmount?: number | null;
  paidAt?: string | null;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

/** Formato do usuário na API (/api/v1/me, /users). */
interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: UserProfile['role'];
  status: UserProfile['status'];
  permissions: UserPermissions;
  photoUrl?: string | null;
  createdAt?: string;
}

const toProfile = (u: ApiUser): UserProfile => ({
  uid: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  permissions: u.permissions,
  photoURL: u.photoUrl ?? undefined,
  createdAt: hydrateDates({ createdAt: u.createdAt }).createdAt,
});

// Campos aceitos por PATCH /settings (o resto do formulário é só exibição).
const SETTINGS_KEYS = [
  'storeName', 'logoUrl', 'contactPhone', 'contactEmail', 'address', 'allowNegativeStock', 'accentColor',
  'autoBackupEnabled', 'enableSoundAlerts', 'monitorAutoScrollEnabled', 'monitorScrollIntervalSeconds',
  'companySharePercent',
] as const;

/** Remove null/undefined para não violar a validação da API em campos opcionais. */
function compact<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function handleApiError(error: unknown, fallback = 'Erro ao comunicar com o servidor.') {
  console.error('API Error:', error);
  const message = error instanceof ApiRequestError || error instanceof Error ? error.message : fallback;
  toast.error(message || fallback);
}

// Context
interface AppContextType {
  user: AppUser | null;
  profile: UserProfile | null;
  products: Product[];
  transactions: Transaction[];
  notifications: Notification[];
  categories: Category[];
  serviceOrders: ServiceOrder[];
  allUsers: UserProfile[];
  users: UserProfile[];
  loading: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  canManageInventory: boolean;
  canManageOS: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canPerformTransactions: boolean;
  canViewInventory: boolean;
  canViewOS: boolean;
  /** 'NEW_PASSWORD_REQUIRED' no primeiro acesso (senha temporária do convite). */
  loginEmail: (email: string, pass: string) => Promise<LoginResult>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  /** Relê o perfil no servidor (ex.: tela de acesso pendente verificando se já foi aprovado). */
  refreshProfile: () => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'createdAt'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addServiceOrder: (os: Omit<ServiceOrder, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  updateServiceOrder: (id: string, updates: Partial<ServiceOrder>) => Promise<void>;
  deleteServiceOrder: (id: string) => Promise<void>;
  bulkAddProducts: (products: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  bulkUpdateProducts: (ids: string[], updates: Partial<Product>) => Promise<void>;
  updateUserRole: (uid: string, role: 'admin' | 'editor' | 'viewer') => Promise<void>;
  updateUserPermissions: (uid: string, permissions: UserPermissions) => Promise<void>;
  updateUserRoleAndPermissions: (uid: string, role: 'admin' | 'editor' | 'viewer', permissions: UserPermissions) => Promise<void>;
  approveUser: (uid: string) => Promise<void>;
  denyUser: (uid: string) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
  addUserByEmail: (email: string, name: string, role: 'admin' | 'editor' | 'viewer', permissions?: UserPermissions) => Promise<void>;
  registerTransaction: (
    productId: string,
    productName: string,
    type: 'in' | 'out',
    quantity: number,
    reason: string,
    userId: string,
    userName: string
  ) => Promise<void>;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  inventoryLowStockFilter: boolean;
  setInventoryLowStockFilter: (v: boolean) => void;
  isMonitorMode: boolean;
  setIsMonitorMode: (v: boolean) => void;
  toggleMonitorMode: () => void;
  settings: SystemSettings;
  updateSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  playLowStockAlertSound: () => void;
  handleBackupToDrive: () => Promise<void>;
  handleRestoreFromDrive: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const ROLE_PRESETS: Record<'admin' | 'editor' | 'viewer', { label: string; description: string; permissions: UserPermissions }> = {
  admin: {
    label: 'Administrador (Admin)',
    description: 'Acesso total irrestrito: gestão de estoque, ordens de serviço, relatórios e controle de usuários.',
    permissions: {
      canManageInventory: true,
      canPerformTransactions: true,
      canManageOS: true,
      canViewReports: true,
      canManageUsers: true,
    }
  },
  editor: {
    label: 'Operador',
    description: 'Execução de rotinas operacionais: gerenciar produtos, registrar movimentações e ordens de serviço.',
    permissions: {
      canManageInventory: true,
      canPerformTransactions: true,
      canManageOS: true,
      canViewReports: true,
      canManageUsers: false,
    }
  },
  viewer: {
    label: 'Visualizador',
    description: 'Somente leitura: consulta de estoque, ordens de serviço e relatórios, sem permissão de alteração.',
    permissions: {
      canManageInventory: false,
      canPerformTransactions: false,
      canManageOS: false,
      canViewReports: true,
      canManageUsers: false,
    }
  }
};

export const getDefaultPermissions = (role: 'admin' | 'editor' | 'viewer'): UserPermissions => {
  return ROLE_PRESETS[role]?.permissions || ROLE_PRESETS.viewer.permissions;
};

export const AppProvider = ({ children }: { children: any }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<SystemSettings>(() => ({
    storeName: 'Munago Mecânica',
    allowNegativeStock: false,
    accentColor: getStoredAccentColor(),
    autoBackupEnabled: false,
    enableSoundAlerts: getStoredSoundAlertsEnabled(),
    monitorAutoScrollEnabled: true,
    monitorScrollIntervalSeconds: 12,
    lastFirestoreBackup: '',
  }));

  const { openGoogleAuth } = useGoogleAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventoryLowStockFilter, setInventoryLowStockFilter] = useState(false);
  const [isMonitorMode, setIsMonitorMode] = useState(false);

  // Som de estoque baixo toca quando chega notificação nova não lida (inclusive gerada por outro usuário).
  const soundEnabledRef = useRef(settings.enableSoundAlerts);
  soundEnabledRef.current = settings.enableSoundAlerts;
  const unreadIdsRef = useRef<Set<string> | null>(null);

  const toggleMonitorMode = () => {
    setIsMonitorMode(prev => !prev);
  };

  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    return getStoredThemePreference();
  });

  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    const pref = getStoredThemePreference();
    return resolveEffectiveTheme(pref) === 'dark';
  });

  const setThemePreference = (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    const effective = resolveEffectiveTheme(pref);
    const isDark = effective === 'dark';
    setDarkModeState(isDark);
    applyThemeToDOM(effective);
    try {
      localStorage.setItem(LOCAL_STORAGE_THEME_KEY, pref);
      localStorage.setItem('darkMode', JSON.stringify(isDark));
    } catch (e) {
      console.error('Error saving theme to localStorage:', e);
    }
  };

  const setDarkMode = (v: boolean) => {
    setThemePreference(v ? 'dark' : 'light');
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setThemePreference(next ? 'dark' : 'light');
    toast.success(next ? 'Modo escuro ativado' : 'Modo claro ativado');
  };

  // Sync effective theme on mount and when themePreference changes or system scheme shifts
  useEffect(() => {
    const effective = resolveEffectiveTheme(themePreference);
    const isDark = effective === 'dark';
    setDarkModeState(isDark);
    applyThemeToDOM(effective);

    if (themePreference === 'system' && typeof window !== 'undefined') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        const sysEffective = e.matches ? 'dark' : 'light';
        setDarkModeState(e.matches);
        applyThemeToDOM(sysEffective);
      };
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    }
  }, [themePreference]);

  // Apply dynamic accent color to all CSS custom properties and shade steps
  useEffect(() => {
    if (settings.accentColor) {
      applyAccentColorToDOM(settings.accentColor);
    }
  }, [settings.accentColor]);

  const clearData = () => {
    setProducts([]);
    setTransactions([]);
    setNotifications([]);
    setCategories([]);
    setServiceOrders([]);
    setAllUsers([]);
    unreadIdsRef.current = null;
  };

  /** Lê a sessão do Cognito e o perfil no servidor (/me cria o perfil no primeiro acesso). */
  const loadSession = useCallback(async () => {
    const token = await getIdToken();
    if (!token) {
      setUser(null);
      setProfile(null);
      return;
    }
    try {
      const p = toProfile(await apiGet<ApiUser>('/me'));
      setProfile(p);
      setUser({ uid: p.uid, email: p.email, displayName: p.name, photoURL: p.photoURL ?? null });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        await cognitoLogout().catch(() => {});
        setUser(null);
        setProfile(null);
        return;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    const finish = () => loadSession()
      .catch((e) => handleApiError(e, 'Não foi possível carregar sua sessão.'))
      .finally(() => setLoading(false));

    // Volta do Google: o Amplify troca o ?code= por tokens e avisa pelo Hub.
    const stopListening = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') finish();
      if (payload.event === 'signInWithRedirect_failure') {
        console.error('Google sign-in failed:', payload.data);
        toast.error('Não foi possível entrar com o Google. Tente novamente.');
        setLoading(false);
      }
    });
    if (!isOAuthReturn()) finish();
    return stopListening;
  }, [loadSession]);

  const isAdmin = profile?.role === 'admin';
  const permissions = profile?.permissions && Object.keys(profile.permissions).length > 0
    ? profile.permissions
    : getDefaultPermissions(profile?.role ?? 'viewer');

  const isEditor = isAdmin || profile?.role === 'editor';
  const isViewer = !isAdmin && !isEditor;

  const canManageInventory = isAdmin || permissions.canManageInventory || false;
  const canManageOS = isAdmin || permissions.canManageOS || false;
  const canManageUsers = isAdmin || permissions.canManageUsers || false;
  const canViewReports = isAdmin || permissions.canViewReports || false;
  const canPerformTransactions = isAdmin || permissions.canPerformTransactions || false;

  // Helper for viewing: all approved users can view inventory and OS (viewers read-only, operators and admins can manage)
  const canViewInventory = true;
  const canViewOS = true;

  const isApproved = !!profile && (profile.status === 'approved' || profile.role === 'admin');
  const canSeeNotifications = canManageInventory || canManageOS;

  // Carrega tudo após aprovação e recarrega cada recurso quando o servidor avisa (SSE).
  useEffect(() => {
    if (!isApproved) return;

    const loaders: Record<string, () => Promise<void>> = {
      products: async () => setProducts((await apiGet<Product[]>('/products')).map(hydrateDates)),
      transactions: async () => setTransactions((await apiGet<Transaction[]>('/transactions')).map(hydrateDates)),
      categories: async () => setCategories((await apiGet<Category[]>('/categories')).map(hydrateDates)),
      serviceOrders: async () => setServiceOrders((await apiGet<ServiceOrder[]>('/service-orders')).map(hydrateDates)),
      settings: async () => {
        const s = await apiGet<SystemSettings & { lastBackup?: string }>('/settings');
        setSettings(prev => ({ ...prev, ...s, lastFirestoreBackup: s.lastBackup ?? '' }));
      },
      notifications: async () => {
        if (!canSeeNotifications) return;
        const list = (await apiGet<Notification[]>('/notifications')).map(hydrateDates);
        const unread = new Set(list.filter(n => !n.read).map(n => n.id));
        const previous = unreadIdsRef.current;
        if (previous && [...unread].some(id => !previous.has(id))) {
          playLowStockAlertIfEnabled(soundEnabledRef.current);
        }
        unreadIdsRef.current = unread;
        setNotifications(list);
      },
      users: async () => {
        if (canManageUsers) setAllUsers((await apiGet<ApiUser[]>('/users')).map(toProfile));
        // Admin pode ter mudado meu cargo/permissões.
        await loadSession();
      },
    };

    for (const [name, load] of Object.entries(loaders)) {
      if (name !== 'users' || canManageUsers) load().catch((e) => handleApiError(e));
    }
    return subscribeChanges((resource) => {
      loaders[resource]?.().catch((e) => handleApiError(e));
    });
  }, [isApproved, canManageUsers, canSeeNotifications, loadSession]);

  const loginEmail = async (email: string, pass: string): Promise<LoginResult> => {
    const result = await cognitoLogin(email, pass);
    if (result === 'DONE') await loadSession();
    return result;
  };

  const completeNewPassword = async (newPassword: string) => {
    await cognitoCompleteNewPassword(newPassword);
    await loadSession();
  };

  const handleLogout = async () => {
    const toastId = toast.loading('Saindo...');
    try {
      // Clear session tokens and cache hints (preserve user theme preferences in localStorage).
      // 'google_tokens' é da versão antiga (tokens no navegador); hoje ficam no servidor, por usuário.
      localStorage.removeItem('google_tokens');
      sessionStorage.clear();

      await cognitoLogout();

      setUser(null);
      setProfile(null);
      clearData();

      toast.success('Você saiu do sistema.', { id: toastId });
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Erro ao sair do sistema.', { id: toastId });
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await apiPatch(`/notifications/${id}/read`, {});
    } catch (error) {
      handleApiError(error);
    }
  };

  const addProductAction = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!canManageInventory) {
      toast.error('Acesso restrito: Você não tem permissão para cadastrar produtos.');
      return;
    }
    const toastId = toast.loading('Salvando produto...');
    try {
      await apiPost('/products', compact(product));
      toast.success('Produto salvo com sucesso!', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar produto.', { id: toastId });
    }
  };

  const updateProductAction = async (id: string, updates: Partial<Product>) => {
    if (!canManageInventory) {
      toast.error('Acesso restrito: Você não tem permissão para alterar produtos.');
      return;
    }
    const toastId = toast.loading('Atualizando produto...');
    try {
      const { id: _id, createdAt: _c, updatedAt: _u, ...data } = updates;
      await apiPatch(`/products/${id}`, compact(data));

      // Check if updated quantity triggers low stock alert
      if (updates.quantity !== undefined) {
        const currentProd = products.find(p => p.id === id);
        const minQ = updates.minQuantity ?? currentProd?.minQuantity ?? 0;
        if (updates.quantity <= minQ) {
          playLowStockAlertIfEnabled(settings.enableSoundAlerts);
        }
      }
      toast.success('Produto atualizado com sucesso!', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar produto.', { id: toastId });
    }
  };

  const deleteProductAction = async (id: string) => {
    if (!canManageInventory) {
      toast.error('Acesso restrito: Você não tem permissão para excluir produtos.');
      return;
    }
    const toastId = toast.loading('Excluindo produto...');
    try {
      await apiDelete(`/products/${id}`);
      toast.success('Produto excluído com sucesso!', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir produto.', { id: toastId });
    }
  };

  const addCategoryAction = async (category: Omit<Category, 'id' | 'createdAt'>) => {
    const toastId = toast.loading('Salvando categoria...');
    try {
      await apiPost('/categories', compact(category));
      toast.success('Categoria salva com sucesso!', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar categoria.', { id: toastId });
    }
  };

  // O servidor propaga o novo nome para os produtos na mesma transação.
  const updateCategoryAction = async (id: string, updates: Partial<Category>) => {
    const toastId = toast.loading('Atualizando categoria...');
    try {
      const { id: _id, createdAt: _c, ...data } = updates;
      await apiPatch(`/categories/${id}`, compact(data));
      toast.success('Categoria atualizada com sucesso!', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar categoria.', { id: toastId });
    }
  };

  const deleteCategoryAction = async (id: string) => {
    const toastId = toast.loading('Excluindo categoria...');
    try {
      await apiDelete(`/categories/${id}`);
      toast.success('Categoria excluída com sucesso!', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir categoria.', { id: toastId });
    }
  };

  // O servidor baixa o estoque e registra as movimentações na mesma transação.
  const addServiceOrderAction = async (os: Omit<ServiceOrder, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!user || !profile) return;
    if (!canManageOS) {
      toast.error('Acesso restrito: Você não possui permissão para gerar Ordens de Serviço.');
      return;
    }
    // Erro sobe para a tela, que mostra o toast.
    await apiPost('/service-orders', compact(os));
  };

  const updateServiceOrderAction = async (id: string, updates: Partial<ServiceOrder>) => {
    if (!canManageOS) {
      toast.error('Acesso restrito: Você não possui permissão para editar Ordens de Serviço.');
      return;
    }
    // Itens e autor não mudam após criar (estoque já foi baixado).
    // Valores do repasse são calculados pelo servidor; só o % pode ser enviado.
    const { id: _id, createdAt: _c, updatedAt: _u, createdBy: _b, companyAmount: _ca, workshopAmount: _wa, paidAt: _pa, items, ...data } = updates;
    const current = serviceOrders.find(o => o.id === id);
    if (items && current && JSON.stringify(items) !== JSON.stringify(current.items)) {
      toast.warning('Os itens de uma OS não podem ser alterados após a criação. Os demais campos foram salvos.');
    }
    await apiPatch(`/service-orders/${id}`, compact(data));
  };

  const deleteServiceOrderAction = async (id: string) => {
    if (!canManageOS) {
      toast.error('Acesso restrito: Você não possui permissão para excluir Ordens de Serviço.');
      return;
    }
    try {
      await apiDelete(`/service-orders/${id}`);
    } catch (error) {
      handleApiError(error);
    }
  };

  const bulkAddProductsAction = async (newProducts: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    try {
      await apiPost('/products/bulk', newProducts.map(p => compact(p)));
    } catch (error) {
      handleApiError(error);
    }
  };

  const bulkUpdateProductsAction = async (ids: string[], updates: Partial<Product>) => {
    try {
      const { id: _id, createdAt: _c, updatedAt: _u, ...data } = updates;
      await apiPatch('/products/bulk', { ids, updates: compact(data) });
    } catch (error) {
      handleApiError(error);
    }
  };

  const patchUser = async (uid: string, body: object, loadingMsg: string, okMsg: string, errMsg: string) => {
    const toastId = toast.loading(loadingMsg);
    try {
      await apiPatch(`/users/${uid}`, body);
      toast.success(okMsg, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : errMsg, { id: toastId });
    }
  };

  const updateUserRoleAction = (uid: string, role: 'admin' | 'editor' | 'viewer') =>
    patchUser(uid, { role }, 'Atualizando cargo...', 'Cargo atualizado com sucesso!', 'Erro ao atualizar cargo.');

  const updateUserPermissionsAction = (uid: string, permissions: UserPermissions) =>
    patchUser(uid, { permissions }, 'Atualizando permissões...', 'Permissões atualizadas com sucesso!', 'Erro ao atualizar permissões.');

  const updateUserRoleAndPermissionsAction = (uid: string, role: 'admin' | 'editor' | 'viewer', permissions: UserPermissions) =>
    patchUser(uid, { role, permissions }, 'Atualizando perfil e permissões...', 'Perfil e permissões atualizados com sucesso!', 'Erro ao atualizar usuário.');

  const approveUserAction = (uid: string) =>
    patchUser(uid, { status: 'approved' }, 'Aprovando usuário...', 'Usuário aprovado com sucesso!', 'Erro ao aprovar usuário.');

  const denyUserAction = (uid: string) =>
    patchUser(uid, { status: 'denied' }, 'Negando acesso...', 'Acesso negado!', 'Erro ao negar acesso.');

  const deleteUserAction = async (uid: string) => {
    const toastId = toast.loading('Excluindo usuário...');
    try {
      await apiDelete(`/users/${uid}`);
      toast.success('Usuário excluído com sucesso!', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Erro ao excluir usuário.', { id: toastId });
    }
  };

  // O Cognito envia o e-mail de convite com senha temporária.
  const addUserByEmailAction = async (email: string, name: string, role: 'admin' | 'editor' | 'viewer', permissions?: UserPermissions) => {
    const toastId = toast.loading('Processando novo usuário...');
    try {
      await apiPost('/users', { email, name, role, permissions: permissions || getDefaultPermissions(role) });
      toast.success('Usuário criado! O convite com a senha temporária foi enviado por e-mail.', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Erro ao adicionar usuário.', { id: toastId });
    }
  };

  // userId/userName ficam na assinatura por compatibilidade: o servidor usa o usuário do token.
  const registerTransactionAction = async (
    productId: string,
    _productName: string,
    type: 'in' | 'out',
    quantity: number,
    reason: string,
    _userId: string,
    _userName: string
  ) => {
    if (!canPerformTransactions) {
      throw new Error('Acesso restrito: você não tem permissão para movimentar o estoque.');
    }
    // O servidor aplica a movimentação no saldo e registra o histórico numa transação só.
    // Erros sobem para a tela (ex.: estoque insuficiente), que mostra a mensagem.
    await apiPost('/transactions', { productId, type, quantity, reason: reason || undefined });
  };

  const updateSettingsAction = async (updates: Partial<SystemSettings>) => {
    const cleanUpdates: Record<string, unknown> = {};
    for (const key of SETTINGS_KEYS) {
      if (updates[key] !== undefined && updates[key] !== null) cleanUpdates[key] = updates[key];
    }

    if (typeof cleanUpdates.accentColor === 'string') {
      applyAccentColorToDOM(cleanUpdates.accentColor);
    }
    if (typeof cleanUpdates.enableSoundAlerts === 'boolean') {
      setStoredSoundAlertsEnabled(cleanUpdates.enableSoundAlerts);
    }

    // Atualiza a tela na hora; só admin grava as configurações globais.
    setSettings(prev => ({ ...prev, ...cleanUpdates }));
    if (!isAdmin) return;

    const toastId = toast.loading('Salvando configurações...');
    try {
      await apiPatch('/settings', cleanUpdates);
      toast.success('Configurações salvas com sucesso!', { id: toastId });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar: ' + (error?.message || 'Verifique permissões'), { id: toastId });
    }
  };

  const ensureDriveToken = async (): Promise<string | null> => {
    const token = await fetchGoogleAccessToken().catch((e) => {
      toast.error(e instanceof Error ? e.message : 'Erro ao acessar a conta Google.');
      return undefined;
    });
    if (token === undefined) return null;
    if (!token) {
      toast.info('Conecte sua conta Google para usar o Drive. Após autorizar, a página será recarregada.');
      openGoogleAuth();
      return null;
    }
    return token;
  };

  const handleBackupToDrive = async () => {
    const token = await ensureDriveToken();
    if (!token) return;

    const toastId = toast.loading('Gerando backup no Google Drive...');
    try {
      const backupData = {
        products,
        categories,
        transactions: transactions.slice(0, 100), // Only last 100 transactions for size
        backupDate: new Date().toISOString(),
        storeName: settings.storeName
      };

      const fileName = `backup_estoque_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
      await createBackupFile(token, fileName, JSON.stringify(backupData, null, 2));

      toast.success('Backup realizado com sucesso no Google Drive!', { id: toastId });
    } catch (error) {
      console.error('Drive Backup Error:', error);
      toast.error('Erro ao realizar backup no Google Drive. Se persistir, reconecte sua conta Google.', { id: toastId });
    }
  };

  const handleRestoreFromDrive = async () => {
    const token = await ensureDriveToken();
    if (!token) return;

    const toastId = toast.loading('Buscando backups...');
    try {
      const files = await listBackups(token);
      if (files.length === 0) {
        toast.error('Nenhum backup encontrado no Google Drive.', { id: toastId });
        return;
      }

      // Sort by name descending (assuming timestamp in name)
      const latestFile = files.sort((a, b) => b.name.localeCompare(a.name))[0];
      toast.loading(`Restaurando: ${latestFile.name}...`, { id: toastId });

      const backupData = JSON.parse(await getFileContent(token, latestFile.id));
      // Restaura produtos e categorias (upsert por id), igual ao comportamento anterior.
      await apiPost('/backups/restore', {
        products: Array.isArray(backupData.products) ? backupData.products : [],
        categories: Array.isArray(backupData.categories) ? backupData.categories : [],
      });

      toast.success('Backup restaurado com sucesso!', { id: toastId });
    } catch (error) {
      console.error('Drive Restore Error:', error);
      toast.error(error instanceof Error && error.message ? error.message : 'Erro ao restaurar backup.', { id: toastId });
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      profile,
      products,
      transactions,
      notifications,
      categories,
      serviceOrders,
      allUsers,
      users: allUsers,
      loading,
      isAdmin,
      isEditor,
      isViewer,
      canManageInventory,
      canManageOS,
      canManageUsers,
      canViewReports,
      canPerformTransactions,
      canViewInventory,
      canViewOS,
      loginEmail,
      completeNewPassword,
      handleLogout,
      refreshProfile: loadSession,
      markNotificationAsRead,
      addProduct: addProductAction,
      updateProduct: updateProductAction,
      deleteProduct: deleteProductAction,
      addCategory: addCategoryAction,
      updateCategory: updateCategoryAction,
      deleteCategory: deleteCategoryAction,
      addServiceOrder: addServiceOrderAction,
      updateServiceOrder: updateServiceOrderAction,
      deleteServiceOrder: deleteServiceOrderAction,
      bulkAddProducts: bulkAddProductsAction,
      bulkUpdateProducts: bulkUpdateProductsAction,
      updateUserRole: updateUserRoleAction,
      updateUserPermissions: updateUserPermissionsAction,
      updateUserRoleAndPermissions: updateUserRoleAndPermissionsAction,
      approveUser: approveUserAction,
      denyUser: denyUserAction,
      deleteUser: deleteUserAction,
      addUserByEmail: addUserByEmailAction,
      registerTransaction: registerTransactionAction,
      themePreference,
      setThemePreference,
      darkMode,
      setDarkMode,
      toggleDarkMode,
      activeTab,
      setActiveTab,
      inventoryLowStockFilter,
      setInventoryLowStockFilter,
      isMonitorMode,
      setIsMonitorMode,
      toggleMonitorMode,
      settings,
      updateSettings: updateSettingsAction,
      playLowStockAlertSound: () => soundManager.playLowStockChime(),
      handleBackupToDrive,
      handleRestoreFromDrive
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
