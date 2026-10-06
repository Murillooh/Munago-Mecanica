import { toast } from 'sonner';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  increment,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  where
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider } from 'firebase/auth';
import { useState, useEffect, createContext, useContext } from 'react';
import { db, auth, loginWithGoogle, logout, loginWithEmail, registerWithEmail } from '../firebase';
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
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

// Error Handling
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Throwing here causes uncaught errors in snapshot listeners.
}

// Context
interface AppContextType {
  user: FirebaseUser | null;
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
  login: () => Promise<void>;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string) => Promise<void>;
  handleLogout: () => Promise<void>;
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
  driveToken: string | null;
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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<SystemSettings>(() => ({
    storeName: 'Munago Estoque',
    allowNegativeStock: false,
    accentColor: getStoredAccentColor(),
    autoBackupEnabled: false,
    enableSoundAlerts: getStoredSoundAlertsEnabled(),
    monitorAutoScrollEnabled: true,
    monitorScrollIntervalSeconds: 12,
    lastFirestoreBackup: '',
  }));

  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventoryLowStockFilter, setInventoryLowStockFilter] = useState(false);
  const [isMonitorMode, setIsMonitorMode] = useState(false);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const emailId = u.email?.toLowerCase() || '';
        const path = `users/${u.uid}`;
        try {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            if (!data.status) {
              const status = (data.role === 'admin' || data.role === 'editor') ? 'approved' : 'pending';
              await updateDoc(userRef, { status });
              setProfile({ ...data, status });
            } else {
              setProfile(data);
            }
          } else if (u.email) {
            // Check if user was pre-assigned by email
            const preAssignedRef = doc(db, 'users', emailId);
            const preAssignedSnap = await getDoc(preAssignedRef);
            
            if (preAssignedSnap.exists()) {
              const preAssignedData = preAssignedSnap.data();
              const role = preAssignedData.role || 'viewer';
              const newProfile: UserProfile = {
                uid: u.uid,
                name: u.displayName || preAssignedData.name || 'Usuário',
                email: emailId,
                role: role,
                photoURL: u.photoURL || undefined,
                permissions: preAssignedData.permissions || getDefaultPermissions(role),
                status: 'approved',
                createdAt: serverTimestamp()
              };
              
              const batch = writeBatch(db);
              batch.delete(preAssignedRef);
              batch.set(userRef, newProfile);
              await batch.commit();
              
              setProfile(newProfile);
            } else if (emailId === 'murillo.silva@locgrupo.com.br' || emailId === 'servidorarquivos@locgrupo.com.br') {
              // Only auto-create for the main admins
              const role = 'admin';
              const newProfile: UserProfile = {
                uid: u.uid,
                name: u.displayName || 'Administrador',
                email: emailId,
                role: role,
                photoURL: u.photoURL || undefined,
                permissions: getDefaultPermissions(role),
                status: 'approved',
                createdAt: serverTimestamp()
              };
              await setDoc(userRef, newProfile);
              setProfile(newProfile);
            } else {
              // New user from Google: Status Pending
              const role = 'viewer';
              const newProfile: UserProfile = {
                uid: u.uid,
                name: u.displayName || 'Novo Usuário',
                email: emailId,
                role: role,
                photoURL: u.photoURL || undefined,
                permissions: getDefaultPermissions(role),
                status: 'pending',
                createdAt: serverTimestamp()
              };
              await setDoc(userRef, newProfile);
              setProfile(newProfile);
              toast.info('Sua solicitação de acesso foi enviada para análise.');
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || !profile || user.uid !== profile.uid) return;
    
    const isMainAdmin = user.email?.toLowerCase().includes('murillo') || user.email?.toLowerCase().includes('servidorarquivos');
    if (profile.status !== 'approved' && !isMainAdmin) return;

    const qProducts = query(collection(db, 'products'), orderBy('name'));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      setProducts(snap.docs.map(d => ({ ...d.data(), id: d.id } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const qTransactions = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsubTransactions = onSnapshot(qTransactions, (snap) => {
      setTransactions(snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const qCategories = query(collection(db, 'categories'), orderBy('name'));
    const unsubCategories = onSnapshot(qCategories, (snap) => {
      setCategories(snap.docs.map(d => ({ ...d.data(), id: d.id } as Category)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const qOS = query(collection(db, 'serviceOrders'), orderBy('createdAt', 'desc'));
    const unsubOS = onSnapshot(qOS, (snap) => {
      setServiceOrders(snap.docs.map(d => ({ ...d.data(), id: d.id } as ServiceOrder)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'serviceOrders'));

    // Admin-only listeners
    let unsubNotifications = () => {};
    let unsubUsers = () => {};

    if (profile?.role === 'admin') {
      const qNotifications = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'));
      unsubNotifications = onSnapshot(qNotifications, (snap) => {
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

      const qUsers = query(collection(db, 'users'), orderBy('name'));
      unsubUsers = onSnapshot(qUsers, (snap) => {
        setAllUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

      // Global Settings Listener
      const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const isLegacyName = !data.storeName || data.storeName.toLowerCase().includes('loc');
          const storeName = isLegacyName ? 'Munago Estoque' : data.storeName;

          setSettings(prev => {
            const resolvedAccentColor = data.accentColor || prev.accentColor || getStoredAccentColor();
            if (resolvedAccentColor) {
              applyAccentColorToDOM(resolvedAccentColor);
            }
            return { 
              ...prev, 
              ...data, 
              accentColor: resolvedAccentColor,
              storeName 
            } as SystemSettings;
          });

          // Auto-migrate legacy name in Firestore to persist Munago Estoque
          if (isLegacyName) {
            setDoc(doc(db, 'settings', 'global'), { storeName: 'Munago Estoque' }, { merge: true }).catch(() => {});
          }
        } else {
          // Initialize in Firestore with Munago Estoque
          setDoc(doc(db, 'settings', 'global'), { 
            storeName: 'Munago Estoque',
            accentColor: getStoredAccentColor()
          }, { merge: true }).catch(() => {});
        }
      }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/global'));

      return () => {
        unsubNotifications();
        unsubUsers();
        unsubSettings();
      };
    }

    return () => {
      unsubProducts();
      unsubTransactions();
      unsubCategories();
      unsubOS();
      unsubNotifications();
      unsubUsers();
    };
  }, [user, profile]);

  const isAdmin = profile?.role === 'admin' || 
    user?.email?.toLowerCase().includes('murillo');
  
  const permissions = (profile?.permissions && Object.keys(profile.permissions).length > 0) 
    ? profile.permissions 
    : (profile?.role ? getDefaultPermissions(profile.role) : getDefaultPermissions('viewer'));
  
  const isEditor = isAdmin || profile?.role === 'editor' || 
    user?.email?.toLowerCase().includes('murillo');

  const isViewer = !isAdmin && !isEditor;

  const canManageInventory = isAdmin || permissions.canManageInventory || false;
  const canManageOS = isAdmin || permissions.canManageOS || false;
  const canManageUsers = isAdmin || permissions.canManageUsers || false;
  const canViewReports = isAdmin || permissions.canViewReports || false;
  const canPerformTransactions = isAdmin || permissions.canPerformTransactions || false;
  
  // Helper for viewing: all approved users can view inventory and OS (viewers read-only, operators and admins can manage)
  const canViewInventory = true;
  const canViewOS = true;

  // Automated Firestore Backups
  useEffect(() => {
    const handleAutoBackup = async () => {
      if (!isAdmin || !settings.autoBackupEnabled || loading) return;
      
      const now = Date.now();
      const lastBackup = settings.lastFirestoreBackup ? new Date(settings.lastFirestoreBackup).getTime() : 0;
      const hoursSinceLastBackup = (now - lastBackup) / (1000 * 60 * 60);

      // Auto backup every 24 hours if enabled
      if (hoursSinceLastBackup > 24 && products.length > 0) {
        try {
          const backupData = {
            timestamp: serverTimestamp(),
            productCount: products.length,
            transactionCount: transactions.length,
            categoryCount: categories.length,
            serviceOrderCount: serviceOrders.length,
            data: {
              products,
              categories,
              transactions: transactions.slice(0, 100),
              serviceOrders: serviceOrders.slice(0, 50)
            }
          };

          await addDoc(collection(db, 'backups'), backupData);
          await setDoc(doc(db, 'settings', 'global'), { 
            ...settings, 
            lastFirestoreBackup: new Date().toISOString() 
          }, { merge: true });

          console.log('Automated Firestore backup created successfully.');
        } catch (error) {
          console.error('Failed to create automated Firestore backup:', error);
        }
      }
    };

    handleAutoBackup();
  }, [isAdmin, settings.autoBackupEnabled, settings.lastFirestoreBackup, loading, products.length]);

  const login = async () => {
    try {
      const result = await loginWithGoogle();
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setDriveToken(credential.accessToken);
        toast.success('Conectado ao Google Drive!');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      let message = 'Erro ao fazer login com Google.';
      if (error.code === 'auth/popup-blocked') {
        message = 'O popup de login foi bloqueado pelo seu navegador.';
        toast.error(message);
      } else if (error.code === 'auth/unauthorized-domain') {
        message = 'Este domínio não está autorizado no Firebase.';
        toast.error(message);
      } else if (error.code === 'auth/popup-closed-by-user') {
        // Just a info/warning toast instead of error for user-initiated closure
        toast.info('Login cancelado.');
        return; 
      } else {
        toast.error(message);
      }
      throw error;
    }
  };

  const loginEmail = async (email: string, pass: string) => {
    try {
      await loginWithEmail(email, pass);
    } catch (error) {
      console.error('Email login error:', error);
      throw error;
    }
  };

  const registerEmail = async (email: string, pass: string) => {
    try {
      await registerWithEmail(email, pass);
    } catch (error) {
      console.error('Email registration error:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    const toastId = toast.loading('Saindo...');
    try {
      // Clear session tokens and cache hints (preserve user theme preferences in localStorage)
      localStorage.removeItem('google_tokens');
      sessionStorage.clear();

      await logout();
      
      setUser(null);
      setProfile(null);
      setProducts([]);
      setTransactions([]);
      setNotifications([]);
      setCategories([]);
      setServiceOrders([]);
      setAllUsers([]);
      
      toast.success('Você saiu do sistema.', { id: toastId });
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Erro ao sair do sistema.', { id: toastId });
    }
  };

  console.log('User permissions debug:', {
    email: user?.email,
    uid: user?.uid,
    role: profile?.role,
    hasPermissionsField: !!profile?.permissions,
    permissionsObject: profile?.permissions,
    finalPermissions: permissions
  });

  const markNotificationAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const addProductAction = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!canManageInventory) {
      toast.error('Acesso restrito: Você não tem permissão para cadastrar produtos.');
      return;
    }
    const toastId = toast.loading('Salvando produto...');
    try {
      await addDoc(collection(db, 'products'), {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('Produto salvo com sucesso!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao salvar produto.', { id: toastId });
      handleFirestoreError(error, OperationType.CREATE, 'products');
    }
  };

  const updateProductAction = async (id: string, updates: Partial<Product>) => {
    if (!canManageInventory && updates.quantity === undefined) {
      toast.error('Acesso restrito: Você não tem permissão para alterar produtos.');
      return;
    }
    const toastId = toast.loading('Atualizando produto...');
    try {
      // Check for negative stock restriction
      if (!settings.allowNegativeStock && updates.quantity !== undefined && updates.quantity < 0) {
        throw new Error('Estoque não pode ser negativo de acordo com as configurações do sistema.');
      }

      await updateDoc(doc(db, 'products', id), {
        ...updates,
        updatedAt: serverTimestamp()
      });

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
      toast.error('Erro ao atualizar produto.', { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
    }
  };

  const deleteProductAction = async (id: string) => {
    if (!canManageInventory) {
      toast.error('Acesso restrito: Você não tem permissão para excluir produtos.');
      return;
    }
    const toastId = toast.loading('Excluindo produto...');
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('Produto excluído com sucesso!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao excluir produto.', { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  const addCategoryAction = async (category: Omit<Category, 'id' | 'createdAt'>) => {
    const toastId = toast.loading('Salvando categoria...');
    try {
      await addDoc(collection(db, 'categories'), {
        ...category,
        aiSuggestion: category.aiSuggestion || '',
        createdAt: serverTimestamp()
      });
      toast.success('Categoria salva com sucesso!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao salvar categoria.', { id: toastId });
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const updateCategoryAction = async (id: string, updates: Partial<Category>) => {
    const toastId = toast.loading('Atualizando categoria...');
    try {
      const oldCategory = categories.find(c => c.id === id);
      const oldName = oldCategory?.name;
      const newName = updates.name;

      await updateDoc(doc(db, 'categories', id), updates);

      // If name changed, update all products using this category
      if (oldName && newName && oldName !== newName) {
        const batch = writeBatch(db);
        const productsToUpdate = products.filter(p => p.category === oldName);
        
        productsToUpdate.forEach(p => {
          batch.update(doc(db, 'products', p.id), { category: newName });
        });
        
        await batch.commit();
      }

      toast.success('Categoria atualizada com sucesso!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao atualizar categoria.', { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, `categories/${id}`);
    }
  };

  const deleteCategoryAction = async (id: string) => {
    const toastId = toast.loading('Excluindo categoria...');
    try {
      // Check if any product is using this category
      const categoryName = categories.find(c => c.id === id)?.name;
      if (categoryName && products.some(p => p.category === categoryName)) {
        throw new Error('Não é possível excluir uma categoria que possui produtos vinculados.');
      }
      await deleteDoc(doc(db, 'categories', id));
      toast.success('Categoria excluída com sucesso!', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir categoria.', { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
    }
  };

  const addServiceOrderAction = async (os: Omit<ServiceOrder, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!user || !profile) return;
    if (!canManageOS) {
      toast.error('Acesso restrito: Você não possui permissão para gerar Ordens de Serviço.');
      return;
    }
    try {
      // Check for negative stock restriction
      if (!settings.allowNegativeStock) {
        for (const item of os.items) {
          const product = products.find(p => p.id === item.productId);
          if (product && product.quantity < item.quantity) {
            throw new Error(`Estoque insuficiente para o item: ${item.name}`);
          }
        }
      }

      const batch = writeBatch(db);
      const osRef = doc(collection(db, 'serviceOrders'));
      
      batch.set(osRef, {
        ...os,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Register transactions and update stock for each item
      for (const item of os.items) {
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          productId: item.productId,
          productName: item.name,
          type: 'out',
          quantity: item.quantity,
          reason: `Ordem de Serviço #${osRef.id.slice(-6).toUpperCase()}`,
          userId: user.uid,
          userName: profile.name,
          timestamp: serverTimestamp()
        });

        const productRef = doc(db, 'products', item.productId);
        batch.update(productRef, {
          quantity: increment(-item.quantity),
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();

      // Check for low stock alerts after batch commit
      for (const item of os.items) {
        const productSnap = await getDoc(doc(db, 'products', item.productId));
        if (productSnap.exists()) {
          const p = productSnap.data() as Product;
          if (p.quantity <= p.minQuantity) {
            // Play gentle low stock sound if enabled
            playLowStockAlertIfEnabled(settings.enableSoundAlerts);

            // Check if there's already an unread notification for this product
            const q = query(
              collection(db, 'notifications'), 
              where('productId', '==', p.id),
              where('read', '==', false),
              where('type', '==', 'low_stock')
            );
            const existingNotifications = await getDocs(q);
            
            if (existingNotifications.empty) {
              await addDoc(collection(db, 'notifications'), {
                title: 'Alerta de Estoque Baixo',
                message: `O produto "${p.name}" atingiu o nível crítico (${p.quantity} unidades).`,
                productId: p.id,
                type: 'low_stock',
                timestamp: serverTimestamp(),
                read: false
              });
            }
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'serviceOrders');
    }
  };

  const updateServiceOrderAction = async (id: string, updates: Partial<ServiceOrder>) => {
    if (!canManageOS) {
      toast.error('Acesso restrito: Você não possui permissão para editar Ordens de Serviço.');
      return;
    }
    try {
      await updateDoc(doc(db, 'serviceOrders', id), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `serviceOrders/${id}`);
    }
  };

  const deleteServiceOrderAction = async (id: string) => {
    if (!canManageOS) {
      toast.error('Acesso restrito: Você não possui permissão para excluir Ordens de Serviço.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'serviceOrders', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `serviceOrders/${id}`);
    }
  };

  const bulkAddProductsAction = async (newProducts: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    try {
      const batch = writeBatch(db);
      newProducts.forEach((product) => {
        const newDocRef = doc(collection(db, 'products'));
        batch.set(newDocRef, {
          ...product,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products/bulk');
    }
  };

  const bulkUpdateProductsAction = async (ids: string[], updates: Partial<Product>) => {
    try {
      // Check for negative stock restriction
      if (!settings.allowNegativeStock && updates.quantity !== undefined && updates.quantity < 0) {
        throw new Error('Estoque não pode ser negativo de acordo com as configurações do sistema.');
      }
      const batch = writeBatch(db);
      ids.forEach(id => {
        const productRef = doc(db, 'products', id);
        batch.update(productRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products/bulk-update');
    }
  };

  const updateUserRoleAction = async (uid: string, role: 'admin' | 'editor' | 'viewer') => {
    const toastId = toast.loading('Atualizando cargo...');
    try {
      await updateDoc(doc(db, 'users', uid), { 
        role,
        permissions: getDefaultPermissions(role)
      });
      toast.success('Cargo atualizado com sucesso!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao atualizar cargo.', { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const updateUserPermissionsAction = async (uid: string, permissions: UserPermissions) => {
    const toastId = toast.loading('Atualizando permissões...');
    try {
      await updateDoc(doc(db, 'users', uid), { permissions });
      toast.success('Permissões atualizadas com sucesso!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao atualizar permissões.', { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const updateUserRoleAndPermissionsAction = async (
    uid: string, 
    role: 'admin' | 'editor' | 'viewer', 
    permissions: UserPermissions
  ) => {
    const toastId = toast.loading('Atualizando perfil e permissões...');
    try {
      await updateDoc(doc(db, 'users', uid), { 
        role,
        permissions
      });
      toast.success('Perfil e permissões atualizados com sucesso!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao atualizar usuário.', { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const approveUserAction = async (uid: string) => {
    const toastId = toast.loading('Aprovando usuário...');
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'approved' });
      toast.success('Usuário aprovado com sucesso!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao aprovar usuário.', { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const denyUserAction = async (uid: string) => {
    const toastId = toast.loading('Negando acesso...');
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'denied' });
      toast.success('Acesso negado!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao negar acesso.', { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const deleteUserAction = async (uid: string) => {
    const toastId = toast.loading('Excluindo usuário...');
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('Usuário excluído com sucesso!', { id: toastId });
    } catch (error) {
      toast.error('Erro ao excluir usuário.', { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const addUserByEmailAction = async (email: string, name: string, role: 'admin' | 'editor' | 'viewer', permissions?: UserPermissions) => {
    const toastId = toast.loading('Processando novo usuário...');
    try {
      const emailId = email.toLowerCase().trim();
      const userPermissions = permissions || getDefaultPermissions(role);
      
      // Generate a random temporary password
      const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
      let password = "";
      for (let i = 0; i < 12; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
      }

      try {
        // Try the backend API first (Automatic Email)
        const response = await fetch('/api/users/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: emailId,
            password,
            name,
            role,
            permissions: userPermissions
          }),
        });

        if (response.ok) {
          toast.success('Usuário criado e e-mail enviado com sucesso!', { id: toastId });
          return;
        }
        
        // If API fails (e.g. missing secrets), we fall back to manual mode
        console.warn('Backend API failed, falling back to manual mode.');
      } catch (e) {
        console.warn('Backend API unreachable, falling back to manual mode.');
      }

      // FALLBACK: Manual Mode (Create doc in Firestore and show password)
      const userRef = doc(db, 'users', emailId);
      await setDoc(userRef, {
        email: emailId,
        name,
        role,
        uid: '', // Will be filled on first login
        tempPassword: password, // Store temporarily so admin can see it
        permissions: userPermissions
      });

      // Show a success message with the password
      toast.dismiss(toastId);
      
      // We'll use a custom event or state to show a modal in the UI
      // For now, let's use a more descriptive toast or an alert (since we can't use window.alert, we'll use a persistent toast)
      toast.success(
        (t) => (
          <div className="flex flex-col gap-2">
            <p className="font-bold">Usuário criado (Modo Manual)</p>
            <p className="text-xs">O e-mail automático não pôde ser enviado, mas o acesso foi liberado.</p>
            <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-xs font-mono">
              Senha: {password}
            </div>
            <button 
              onClick={() => {
                const msg = `Olá ${name}! Sua conta no Munago Estoque foi criada.\n\nUsuário: ${emailId}\nSenha: ${password}\nAcesse em: ${window.location.origin}`;
                navigator.clipboard.writeText(msg);
                toast.success('Mensagem copiada!', { id: 'copy-success' });
                toast.dismiss(t.id);
              }}
              className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-bold uppercase"
            >
              Copiar Mensagem de Boas-Vindas
            </button>
          </div>
        ),
        { duration: 10000 }
      );

    } catch (error) {
      console.error('Error adding user:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar usuário.', { id: toastId });
    }
  };

  const registerTransactionAction = async (
    productId: string, 
    productName: string, 
    type: 'in' | 'out', 
    quantity: number, 
    reason: string,
    userId: string,
    userName: string
  ) => {
    if (!canPerformTransactions) {
      toast.error('Acesso restrito: Você não tem permissão para realizar movimentações no estoque.');
      return;
    }
    try {
      // Check for negative stock restriction
      if (type === 'out' && !settings.allowNegativeStock) {
        const product = products.find(p => p.id === productId);
        if (product && product.quantity < quantity) {
          throw new Error('Estoque insuficiente para realizar esta saída.');
        }
      }

      const transactionData = {
        productId,
        productName,
        type,
        quantity,
        reason,
        timestamp: serverTimestamp(),
        userId,
        userName
      };

      await addDoc(collection(db, 'transactions'), transactionData);
      
      // Update product quantity
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        quantity: increment(type === 'in' ? quantity : -quantity),
        updatedAt: serverTimestamp()
      });

      // Check for low stock alert
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const p = productSnap.data() as Product;
        if (p.quantity <= p.minQuantity) {
          // Play gentle low stock sound if enabled
          playLowStockAlertIfEnabled(settings.enableSoundAlerts);

          // Check if there's already an unread notification for this product
          const q = query(
            collection(db, 'notifications'), 
            where('productId', '==', p.id),
            where('read', '==', false),
            where('type', '==', 'low_stock')
          );
          const existingNotifications = await getDocs(q);
          
          if (existingNotifications.empty) {
            await addDoc(collection(db, 'notifications'), {
              title: 'Alerta de Estoque Baixo',
              message: `O produto "${p.name}" atingiu o nível crítico (${p.quantity} unidades).`,
              productId: p.id,
              type: 'low_stock',
              timestamp: serverTimestamp(),
              read: false
            });
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions/products');
    }
  };

  const updateSettingsAction = async (updates: Partial<SystemSettings>) => {
    // 1. Sanitize updates to prevent any undefined values from causing Firestore setDoc fatal errors
    const cleanUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }

    // 2. If accentColor is updated, apply immediately to DOM & localStorage
    if (cleanUpdates.accentColor) {
      applyAccentColorToDOM(cleanUpdates.accentColor);
    }

    // Handle sound alert toggle local storage persistence
    if (typeof cleanUpdates.enableSoundAlerts === 'boolean') {
      setStoredSoundAlertsEnabled(cleanUpdates.enableSoundAlerts);
    }

    // 3. Immediately update local state so the UI responds without lag
    setSettings(prev => ({ ...prev, ...cleanUpdates }));

    const toastId = toast.loading('Salvando configurações...');
    try {
      await setDoc(doc(db, 'settings', 'global'), cleanUpdates, { merge: true });
      toast.success('Configurações salvas com sucesso!', { id: toastId });
    } catch (error: any) {
      console.error('Error saving settings to Firestore:', error);
      // If Firestore reports permission or network issue, user's local appearance is preserved
      toast.error('Erro ao sincronizar na nuvem: ' + (error?.message || 'Verifique permissões'), { id: toastId });
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    }
  };

  const handleBackupToDrive = async () => {
    if (!driveToken) {
      toast.error('Você precisa estar conectado ao Google Drive para fazer o backup.');
      return;
    }

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
      await createBackupFile(driveToken, fileName, JSON.stringify(backupData, null, 2));
      
      toast.success('Backup realizado com sucesso no Google Drive!', { id: toastId });
    } catch (error) {
      console.error('Drive Backup Error:', error);
      toast.error('Erro ao realizar backup no Google Drive.', { id: toastId });
    }
  };

  const handleRestoreFromDrive = async () => {
    if (!driveToken) {
      toast.error('Você precisa estar conectado ao Google Drive para restaurar o backup.');
      return;
    }

    const toastId = toast.loading('Buscando backups...');
    try {
      const files = await listBackups(driveToken);
      if (files.length === 0) {
        toast.error('Nenhum backup encontrado no Google Drive.', { id: toastId });
        return;
      }

      // Sort by name descending (assuming timestamp in name)
      const latestFile = files.sort((a, b) => b.name.localeCompare(a.name))[0];
      
      toast.loading(`Restaurando: ${latestFile.name}...`, { id: toastId });
      
      const content = await getFileContent(driveToken, latestFile.id);
      const backupData = JSON.parse(content);
      
      const batch = writeBatch(db);
      
      // We will only do a basic restore adding missing data or overwriting depending on logic.
      // But for total restoration, this could be destructive. Let's just restore products for now
      // or at least insert whatever is in the backup that isn't here.
      // Easiest is to push to db. But writing everything could cause quota issues.
      // Let's do a simple update loop for products and categories:

      if (backupData.products && Array.isArray(backupData.products)) {
        for (const product of backupData.products) {
          const productRef = doc(db, 'products', product.id);
          batch.set(productRef, {
            ...product,
            updatedAt: serverTimestamp()
          }, { merge: true }); // Merge to not overwrite new fields if they exist
        }
      }

      if (backupData.categories && Array.isArray(backupData.categories)) {
        for (const category of backupData.categories) {
          const categoryRef = doc(db, 'categories', category.id);
          batch.set(categoryRef, {
            ...category,
          }, { merge: true });
        }
      }

      await batch.commit();

      toast.success('Backup restaurado com sucesso!', { id: toastId });
    } catch (error) {
      console.error('Drive Restore Error:', error);
      toast.error('Erro ao restaurar backup.', { id: toastId });
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
      login, 
      loginEmail,
      registerEmail,
      handleLogout,
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
      driveToken,
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
