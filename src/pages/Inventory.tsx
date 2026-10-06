import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Plus, 
  Filter, 
  Download, 
  Upload, 
  Tag, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  History, 
  Building, 
  Sparkles, 
  FileSpreadsheet, 
  FileText,
  Package,
  Loader2,
  LogIn,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  DollarSign,
  Boxes,
  Barcode,
  Layers,
  ShieldAlert,
  Wrench,
  Save,
  Image as ImageIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import CategoryManager from '../components/CategoryManager';
import { exportInventoryToPDF } from '../lib/pdfExport';

import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { InventoryAISummary } from '../components/InventoryAISummary';
import { authFetch } from '../lib/api';

export const Inventory = () => {
  const { 
    products, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    registerTransaction, 
    user, 
    categories, 
    isAdmin, 
    isEditor,
    canManageInventory,
    canPerformTransactions,
    inventoryLowStockFilter,
    setInventoryLowStockFilter,
    settings,
    isMonitorMode,
    toggleMonitorMode
  } = useApp();

  const { openGoogleAuth, isLoading: isAuthenticatingGoogle } = useGoogleAuth();

  const generateImage = async (category: string) => {
    toast.error('Gerar imagens requer chave de API Gemini no backend.');
    return '';
  };
  const fetchGoogleSheetsData = async (spreadsheetId: string, range: string) => {
    const tokens = localStorage.getItem('google_tokens');
    if (!tokens) {
      throw new Error('Não autenticado com o Google.');
    }

    const response = await authFetch(`/api/sheets/data?spreadsheetId=${encodeURIComponent(spreadsheetId)}&range=${encodeURIComponent(range)}`, {
      headers: {
        'x-google-tokens': tokens
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Falha ao buscar dados do Google Sheets');
    }

    const data = await response.json();
    return data.values || [];
  };
  const googleConfig = { hasClientId: true, hasClientSecret: true };

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [formCategory, setFormCategory] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [deleteProductConfirm, setDeleteProductConfirm] = useState<string | null>(null);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const [isAiSummaryOpen, setIsAiSummaryOpen] = useState(false);
  const [isFetchingSheets, setIsFetchingSheets] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [sheetRange, setSheetRange] = useState('Página1!A1:Z100');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    if (selectedProduct) {
      setFormCategory(selectedProduct.category || '');
      setFormImageUrl(selectedProduct.imageUrl || '');
    } else {
      setFormCategory('');
      setFormImageUrl('');
    }
  }, [selectedProduct, isModalOpen]);

  useEffect(() => {
    // Check if we have google tokens in local storage
    const tokens = localStorage.getItem('google_tokens');
    if (tokens) {
      setIsGoogleAuthenticated(true);
    }
  }, []);

  const filteredProducts = useMemo(() => {
    return (products || []).filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchesLowStock = !inventoryLowStockFilter || p.quantity <= (p.minQuantity || 5);
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [products, searchTerm, categoryFilter, inventoryLowStockFilter]);

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const productData = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      category: formCategory,
      price: Number(formData.get('price')),
      laborCost: Number(formData.get('laborCost')),
      description: formData.get('description') as string,
      imageUrl: formImageUrl,
      minQuantity: Number(formData.get('minQuantity')),
      status: formData.get('status') as string,
      supplier: formData.get('supplier') as string,
      batch: formData.get('batch') as string,
      expirationDate: formData.get('expirationDate') as string,
      observation: formData.get('observation') as string,
    };

    try {
      if (selectedProduct) {
        await updateProduct(selectedProduct.id, productData);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await addProduct({ 
          ...productData, 
          quantity: Number(formData.get('quantity')),
          createdAt: new Date(),
          lastUpdated: new Date()
        });
        toast.success('Produto adicionado ao estoque!');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Erro ao salvar produto.');
    }
  };

  const handleMovement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const qty = Number(formData.get('quantity'));
    const reason = formData.get('reason') as string;

    if (movementType === 'out' && (selectedProduct.quantity < qty)) {
       toast.error('Saldo insuficiente para esta saída.');
       return;
    }

    try {
      const newQty = movementType === 'in' ? 
        selectedProduct.quantity + qty : 
        selectedProduct.quantity - qty;

      await updateProduct(selectedProduct.id, { quantity: newQty });
      await registerTransaction(
        selectedProduct.id,
        selectedProduct.name,
        movementType,
        qty,
        reason,
        user?.uid || '',
        user?.displayName || user?.email || 'Sistema'
      );

      toast.success(`Estoque atualizado: ${movementType === 'in' ? '+' : '-'}${qty}`);
      setIsMovementModalOpen(false);
    } catch (error) {
      console.error('Error recording movement:', error);
      toast.error('Erro ao processar movimentação.');
    }
  };

  const generateCategoryImage = async () => {
    if (!formCategory) {
      toast.error('Selecione uma categoria primeiro.');
      return;
    }
    setIsGeneratingImage(true);
    try {
      const url = await generateImage(formCategory);
      setFormImageUrl(url);
      toast.success('Imagem gerada por IA!');
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Erro ao gerar imagem.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleExportData = (format: 'csv' | 'xlsx') => {
    const data = filteredProducts.map(p => ({
      SKU: p.sku || '',
      Nome: p.name || '',
      Categoria: p.category || '',
      Quantidade: p.quantity || 0,
      Preço: p.price || 0,
      'Valor Total': (p.price || 0) * (p.quantity || 0)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    const filename = `estoque-loc-${new Date().toLocaleDateString().replace(/\//g, '-')}.${format}`;
    if (format === 'csv') {
      XLSX.writeFile(wb, filename, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, filename);
    }
    toast.success(`Exportação para ${format.toUpperCase()} concluída!`);
  };

  const handleExportPDF = () => {
    try {
      const isFiltered = searchTerm || categoryFilter !== 'all' || inventoryLowStockFilter;
      const filterDesc = isFiltered 
        ? [
            searchTerm ? `Busca: "${searchTerm}"` : null,
            categoryFilter !== 'all' ? `Categoria: ${categoryFilter}` : null,
            inventoryLowStockFilter ? 'Apenas Estoque Baixo' : null
          ].filter(Boolean).join(' | ')
        : 'Catálogo Geral';

      exportInventoryToPDF({
        storeName: settings?.storeName || 'Munago Estoque',
        products: filteredProducts,
        filterLabel: filterDesc
      });
      toast.success('Relatório em PDF gerado com sucesso!');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao gerar relatório em PDF.');
    }
  };

  const handleGoogleAuth = () => {
    openGoogleAuth('sheets');
  };

  const extractSpreadsheetId = (urlOrId: string): string => {
    const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : urlOrId.trim();
  };

  const handleFetchGoogleSheetsData = async () => {
    if (!spreadsheetUrl.trim()) {
      toast.error('Por favor, informe a URL ou o ID de sua planilha Google.');
      return;
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    setIsFetchingSheets(true);
    const toastId = toast.loading('Sincronizando planilha com o banco de dados...');
    
    try {
      const values = await fetchGoogleSheetsData(spreadsheetId, sheetRange);
      if (!values || values.length < 2) {
        toast.error('Planilha vazia ou com dados insuficientes (é necessário ao menos cabeçalho e uma linha de dados).', { id: toastId });
        setIsFetchingSheets(false);
        return;
      }

      // Parse headers from the first row
      const headers = values[0].map((h: any) => (h || '').toString().toLowerCase().trim());
      
      // Auto-detect columns indices
      let skuIdx = headers.findIndex((h: string) => h.includes('sku') || h.includes('código') || h.includes('codigo') || h.includes('tag') || h.includes('id'));
      let nameIdx = headers.findIndex((h: string) => h.includes('nome') || h.includes('produto') || h.includes('item') || h.includes('descri') || h.includes('titulo'));
      let qtyIdx = headers.findIndex((h: string) => h.includes('quant') || h.includes('qtd') || h.includes('quantidade') || h.includes('estoque') || h.includes('saldo'));
      let priceIdx = headers.findIndex((h: string) => h.includes('preç') || h.includes('preco') || h.includes('preço') || h.includes('valor') || h.includes('custo') || h.includes('venda'));
      let categoryIdx = headers.findIndex((h: string) => h.includes('cat') || h.includes('categoria'));
      let minQtyIdx = headers.findIndex((h: string) => h.includes('min') || h.includes('mín') || h.includes('alerta') || h.includes('mínimo'));

      // Fallbacks if name is not auto-detected
      if (nameIdx === -1) {
        skuIdx = skuIdx !== -1 ? skuIdx : 0;
        nameIdx = nameIdx !== -1 ? nameIdx : 1;
        qtyIdx = qtyIdx !== -1 ? qtyIdx : 2;
        priceIdx = priceIdx !== -1 ? priceIdx : 3;
      }

      let addedCount = 0;
      let updatedCount = 0;

      // Iterate through rows (skipping headers)
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row || row.length === 0) continue;

        const name = row[nameIdx] ? row[nameIdx].toString().trim() : '';
        if (!name) continue;

        const sku = skuIdx !== -1 && row[skuIdx] ? row[skuIdx].toString().trim() : '';
        
        // Parse numeric values safely
        const rawQty = qtyIdx !== -1 && row[qtyIdx] ? row[qtyIdx].toString().replace(/[^\d.-]/g, '') : '0';
        const quantity = Math.max(0, parseInt(rawQty, 10) || 0);

        const rawPrice = priceIdx !== -1 && row[priceIdx] ? row[priceIdx].toString().replace(/[^\d.,-]/g, '').replace(',', '.') : '0';
        const price = Math.max(0, parseFloat(rawPrice) || 0);

        const category = categoryIdx !== -1 && row[categoryIdx] ? row[categoryIdx].toString().trim() : 'Geral';
        
        const rawMinQty = minQtyIdx !== -1 && row[minQtyIdx] ? row[minQtyIdx].toString().replace(/[^\d.-]/g, '') : '5';
        const minQuantity = Math.max(1, parseInt(rawMinQty, 10) || 5);

        // Find existing product by SKU or exact Name matches
        const existingProduct = products.find(p => (sku && p.sku === sku) || (p.name.toLowerCase() === name.toLowerCase()));

        if (existingProduct) {
          // Update existing keys
          await updateProduct(existingProduct.id, {
            sku: sku || existingProduct.sku || '',
            name: name,
            quantity: quantity,
            price: price,
            category: category,
            minQuantity: minQuantity,
            lastUpdated: new Date()
          });
          updatedCount++;
        } else {
          // Add brand new product
          await addProduct({
            sku: sku,
            name: name,
            quantity: quantity,
            price: price,
            category: category,
            minQuantity: minQuantity,
            createdAt: new Date(),
            lastUpdated: new Date()
          });
          addedCount++;
        }
      }

      toast.success(`Sincronização concluída! Adicionados: ${addedCount}, Atualizados: ${updatedCount}`, { id: toastId, duration: 5000 });
      setIsGoogleSheetsModalOpen(false);
    } catch (e: any) {
      console.error('Error synchronizing sheet:', e);
      toast.error(`Falha ao sincronizar: ${e.message || 'Erro desconhecido'}`, { id: toastId });
    } finally {
      setIsFetchingSheets(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-32"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Almoxarifado & Estoque</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Catálogo completo de peças e controle de movimentações físicas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
            title="Exportar Relatório Geral de Estoque em PDF"
          >
            <FileText size={14} className="text-zinc-500" />
            <span>Relatório PDF</span>
          </button>
          
          <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs">
            <button 
              onClick={() => handleExportData('csv')}
              className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 px-2.5 py-2 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 border-r border-zinc-200/80 dark:border-zinc-800 transition-colors"
            >
              <Download size={13} className="text-zinc-500" />
              CSV
            </button>
            <button 
              onClick={() => handleExportData('xlsx')}
              className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 px-2.5 py-2 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <FileSpreadsheet size={13} className="text-zinc-500" />
              Excel
            </button>
          </div>

          <button 
            onClick={() => setIsGoogleSheetsModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors shadow-xs"
          >
            <FileSpreadsheet size={14} />
            Sheets Sync
          </button>

          <button 
            onClick={() => setIsAiSummaryOpen(true)}
            className="inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-zinc-200 transition-colors shadow-xs"
          >
            <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
            Análise IA
          </button>

          {canManageInventory && (
            <button 
              onClick={() => { setSelectedProduct(null); setIsModalOpen(true); }}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus size={14} />
              Novo Produto
            </button>
          )}
        </div>
      </div>

      {/* Quick Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total de SKUs</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Package size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-zinc-900 dark:text-white tabular-nums">{products.length}</span>
            <span className="text-xs text-zinc-500">itens cadastrados</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Patrimônio em Peças</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-zinc-900 dark:text-white tabular-nums truncate">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(
                products.reduce((acc, p) => acc + (p.price || 0) * (p.quantity || 0), 0)
              )}
            </span>
          </div>
        </div>

        <div 
          onClick={() => setInventoryLowStockFilter(!inventoryLowStockFilter)}
          className={`bg-white dark:bg-zinc-900 border p-3.5 rounded-xl shadow-xs cursor-pointer transition-all ${
            inventoryLowStockFilter 
              ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20 dark:bg-red-950/20' 
              : 'border-zinc-200/80 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Estoque Crítico / Baixo</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                {products.filter(p => p.quantity <= (p.minQuantity || 5)).length}
              </span>
              <span className="text-xs text-zinc-500">abaixo do mínimo</span>
            </div>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
              {inventoryLowStockFilter ? 'Ver todos' : 'Filtrar'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Volume Físico Total</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Boxes size={14} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-zinc-900 dark:text-white tabular-nums">
              {products.reduce((acc, p) => acc + (p.quantity || 0), 0)}
            </span>
            <span className="text-xs text-zinc-500">unidades totais</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
            <input 
              type="text" 
              placeholder="Buscar por SKU, nome ou código..." 
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg text-xs sm:text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors shadow-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div className="relative min-w-[160px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <select 
              className="w-full pl-8 pr-7 py-2 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg text-xs sm:text-sm font-medium outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors shadow-xs appearance-none cursor-pointer text-zinc-800 dark:text-zinc-200"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setInventoryLowStockFilter(false);
              }}
            >
              <option value="all">Todas as Categorias</option>
              {(categories || []).map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {inventoryLowStockFilter && (
            <button 
              onClick={() => setInventoryLowStockFilter(false)}
              className="px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-100 flex items-center gap-1.5"
            >
              <AlertTriangle size={13} /> Filtrando Críticos · Limpar
            </button>
          )}
        </div>

        {/* View Mode & Count */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          <span className="text-xs text-zinc-500 tabular-nums">
            <strong className="text-zinc-900 dark:text-white font-semibold">{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'item' : 'itens'}
          </span>

          <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/80 dark:border-zinc-700">
            <button
              onClick={() => setViewMode('grid')}
              title="Exibir em Grade Compacta"
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Exibir em Tabela Operacional"
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
          <Package size={28} className="mx-auto text-zinc-400 mb-2" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Nenhum produto localizado</p>
          <p className="text-xs text-zinc-500 mt-1">Tente ajustar seus termos de pesquisa ou filtros de categoria.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
          <AnimatePresence>
            {filteredProducts.map((p) => {
              const isLow = p.quantity <= (p.minQuantity || 5);
              return (
                <motion.div
                  layout
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-3 sm:p-3.5 rounded-xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col justify-between group relative"
                >
                  <div>
                    {/* Top Tag & Actions */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded truncate max-w-[110px] ${
                        isLow ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {p.category || 'Sem Categoria'}
                      </span>

                      {canManageInventory && (
                        <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setSelectedProduct(p); setIsModalOpen(true); }}
                            className="p-1 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                            title="Editar Peça"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            onClick={() => setDeleteProductConfirm(p.id)}
                            className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Image & Product Info */}
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-11 h-11 rounded-lg border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Package size={18} className="text-zinc-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-mono text-zinc-400 block truncate leading-none">
                          {p.sku || 'S/ SKU'}
                        </span>
                        <h3 className="text-xs font-semibold text-zinc-900 dark:text-white line-clamp-2 mt-1 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={p.name}>
                          {p.name}
                        </h3>
                      </div>
                    </div>

                    {/* Stock & Cost Row */}
                    <div className="grid grid-cols-2 gap-2 py-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
                      <div>
                        <span className="text-[9px] uppercase tracking-wide font-medium text-zinc-400 block">Saldo</span>
                        <div className="flex items-baseline gap-0.5">
                          <span className={`text-base font-bold tabular-nums ${isLow ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
                            {p.quantity}
                          </span>
                          <span className="text-[9px] font-medium text-zinc-400">UN</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wide font-medium text-zinc-400 block">Custo Médio</span>
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums block truncate" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price || 0)}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {canPerformTransactions && (
                    <div className="flex gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                      <button 
                        onClick={() => { setSelectedProduct(p); setMovementType('in'); setIsMovementModalOpen(true); }}
                        className="flex-1 py-1 px-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-md font-semibold text-[11px] transition-colors flex items-center justify-center gap-1"
                      >
                        <ArrowDownLeft size={12} /> Entrar
                      </button>
                      <button 
                        onClick={() => { setSelectedProduct(p); setMovementType('out'); setIsMovementModalOpen(true); }}
                        className="flex-1 py-1 px-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 rounded-md font-semibold text-[11px] transition-colors flex items-center justify-center gap-1"
                      >
                        <ArrowUpRight size={12} /> Sair
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase text-[10px] tracking-wider bg-zinc-50/50 dark:bg-zinc-800/40">
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3">Código/SKU</th>
                <th className="py-2.5 px-3">Categoria</th>
                <th className="py-2.5 px-3 text-right">Saldo Atual</th>
                <th className="py-2.5 px-3 text-right">Margem Mín.</th>
                <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                <th className="py-2.5 px-3 text-right">Total em Estoque</th>
                <th className="py-2.5 px-3 text-center">Movimentação</th>
                {canManageInventory && <th className="py-2.5 px-3 text-center">Gerenciar</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredProducts.map((p) => {
                const isLow = p.quantity <= (p.minQuantity || 5);
                const totalVal = (p.price || 0) * (p.quantity || 0);
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package size={14} className="text-zinc-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-zinc-900 dark:text-white block truncate max-w-[220px]" title={p.name}>
                            {p.name}
                          </span>
                          {p.location && (
                            <span className="text-[10px] text-zinc-400">Loc: {p.location}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {p.sku || 'S/ SKU'}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {p.category || 'Sem Categoria'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      <span className={`font-bold ${isLow ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
                        {p.quantity} un
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-zinc-500">
                      {p.minQuantity || 5} un
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300 font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-zinc-900 dark:text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVal)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {canPerformTransactions && (
                        <div className="inline-flex gap-1">
                          <button 
                            onClick={() => { setSelectedProduct(p); setMovementType('in'); setIsMovementModalOpen(true); }}
                            className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded text-[11px] font-semibold"
                            title="Registrar Entrada"
                          >
                            + Entrada
                          </button>
                          <button 
                            onClick={() => { setSelectedProduct(p); setMovementType('out'); setIsMovementModalOpen(true); }}
                            className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-red-50 hover:text-red-600 rounded text-[11px] font-semibold"
                            title="Registrar Saída"
                          >
                            - Saída
                          </button>
                        </div>
                      )}
                    </td>
                    {canManageInventory && (
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex gap-1">
                          <button 
                            onClick={() => { setSelectedProduct(p); setIsModalOpen(true); }}
                            className="p-1 text-zinc-400 hover:text-blue-600 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            onClick={() => setDeleteProductConfirm(p.id)}
                            className="p-1 text-zinc-400 hover:text-red-600 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

       {/* Google Sheets Sync Modal */}
       <AnimatePresence>
        {isGoogleSheetsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGoogleSheetsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden z-10"
            >
              <div className="p-4 sm:p-5 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/90 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/50 dark:border-emerald-900/50 shadow-xs">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Sincronização Google Sheets</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Sincronize SKUs, saldos e custos em tempo real.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGoogleSheetsModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-zinc-200/70 dark:border-zinc-700/70">
                  Mapeamento inteligente e automático: detecta colunas de <strong>SKU</strong>, <strong>Nome/Descrição</strong>, <strong>Quantidade</strong>, <strong>Preço Unitário</strong> e <strong>Estoque Mínimo</strong>.
                </p>

                {isGoogleAuthenticated && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Link ou ID da Planilha Google *
                      </label>
                      <input
                        type="text"
                        placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-medium text-zinc-900 dark:text-white outline-none focus:border-emerald-600 transition-colors"
                        value={spreadsheetUrl}
                        onChange={(e) => setSpreadsheetUrl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Intervalo (Range / Página)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Folha1!A1:Z100 ou A1:Z100"
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-medium text-zinc-900 dark:text-white outline-none focus:border-emerald-600 transition-colors"
                        value={sheetRange}
                        onChange={(e) => setSheetRange(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {googleConfig && (!googleConfig.hasClientId || !googleConfig.hasClientSecret) && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-3 rounded-xl text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                    <AlertTriangle size={15} /> Credenciais OAuth do Google pendentes no ambiente.
                  </div>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsGoogleSheetsModalOpen(false)}
                    className="flex-1 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200/80 dark:border-zinc-700"
                  >
                    Cancelar
                  </button>
                  {!isGoogleAuthenticated ? (
                    <button 
                      type="button"
                      onClick={handleGoogleAuth}
                      disabled={!googleConfig?.hasClientId}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <LogIn size={15} /> Conectar Google
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={handleFetchGoogleSheetsData}
                      disabled={isFetchingSheets}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isFetchingSheets ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      {isFetchingSheets ? 'Puxando Dados...' : 'Sincronizar Agora'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CategoryManager 
        isOpen={isCategoryManagerOpen} 
        onClose={() => setIsCategoryManagerOpen(false)} 
      />

       {/* Product Modal - Refined Enterprise Design */}
       <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] z-10"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/90 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/50 dark:border-blue-900/50 shadow-xs shrink-0">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                      {selectedProduct ? 'Auditoria de Produto' : 'Cadastrar Novo Item'}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {selectedProduct 
                        ? `SKU: ${selectedProduct.sku || 'Sem SKU'} · Saldo em Estoque: ${selectedProduct.quantity} un` 
                        : 'Preencha as especificações cadastrais, valores e margem de reposição.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
              
              {/* Modal Body / Form */}
              <form id="product-form" onSubmit={handleSaveProduct} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
                
                {/* Grupo 1: Identificação & Dados Básicos */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-wide uppercase">
                      1. Identificação & Catálogo
                    </span>
                    <span className="text-[11px] text-zinc-400">Campos obrigatórios com *</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {/* SKU */}
                    <div className="sm:col-span-4 space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Barcode size={13} className="text-zinc-400" />
                        Código / SKU *
                      </label>
                      <input 
                        name="sku" 
                        defaultValue={selectedProduct?.sku} 
                        placeholder="Ex: PECA-001" 
                        required
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl font-mono text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white uppercase outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors" 
                      />
                    </div>

                    {/* Descrição Comercial */}
                    <div className="sm:col-span-8 space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Tag size={13} className="text-zinc-400" />
                        Descrição Comercial / Nome *
                      </label>
                      <input 
                        name="name" 
                        defaultValue={selectedProduct?.name} 
                        placeholder="Ex: Amortecedor Dianteiro Direito"
                        required 
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-medium text-zinc-900 dark:text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors" 
                      />
                    </div>

                    {/* Categorização */}
                    <div className="sm:col-span-6 space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Layers size={13} className="text-zinc-400" />
                          Categoria
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsCategoryManagerOpen(true)}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          + Gerenciar
                        </button>
                      </label>
                      <div className="flex items-center gap-2">
                        <select 
                          name="category" 
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-medium text-zinc-900 dark:text-white outline-none focus:border-blue-600 transition-colors cursor-pointer appearance-none"
                        >
                          <option value="">Sem Categoria</option>
                          {(categories || []).map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={generateCategoryImage}
                          disabled={isGeneratingImage || !formCategory}
                          className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-indigo-600 dark:text-indigo-400 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-colors disabled:opacity-40 shrink-0"
                          title="Gerar sugestão de imagem da categoria com IA"
                        >
                          {isGeneratingImage ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Fornecedor / Fabricante */}
                    <div className="sm:col-span-6 space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Building size={13} className="text-zinc-400" />
                        Fornecedor / Fabricante
                      </label>
                      <input 
                        name="supplier" 
                        defaultValue={selectedProduct?.supplier} 
                        placeholder="Ex: Monroe, Bosch, Cofap..." 
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-medium text-zinc-900 dark:text-white outline-none focus:border-blue-600 transition-colors" 
                      />
                    </div>
                  </div>
                </div>

                {/* Grupo 2: Estoque & Parâmetros de Ruptura */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-wide uppercase">
                      2. Controle de Estoque & Segurança
                    </span>
                    <span className="text-[11px] text-zinc-400">Gatilhos de aviso sonoro</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Estoque Inicial ou Saldo Atual */}
                    {!selectedProduct ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <Boxes size={13} className="text-zinc-400" />
                          Estoque Inicial *
                        </label>
                        <div className="relative">
                          <input 
                            name="quantity" 
                            type="number" 
                            min="0"
                            defaultValue={1}
                            required 
                            className="w-full pl-3 pr-8 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums outline-none focus:border-blue-600 transition-colors" 
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-zinc-400">un</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <Boxes size={13} className="text-zinc-400" />
                          Saldo Atual
                        </label>
                        <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                          <span>{selectedProduct.quantity} un</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsMovementModalOpen(true);
                            }}
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Movimentar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Estoque Mínimo (Alerta) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <ShieldAlert size={13} className="text-amber-500" />
                        Estoque Mínimo *
                      </label>
                      <div className="relative">
                        <input 
                          name="minQuantity" 
                          type="number" 
                          min="0"
                          defaultValue={selectedProduct?.minQuantity ?? 5} 
                          required
                          className="w-full pl-3 pr-8 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums outline-none focus:border-blue-600 transition-colors" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-zinc-400">un</span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Status do Item
                      </label>
                      <select
                        name="status"
                        defaultValue={selectedProduct?.status || 'ativo'}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-medium text-zinc-900 dark:text-white outline-none focus:border-blue-600 transition-colors cursor-pointer"
                      >
                        <option value="ativo">Ativo (Operacional)</option>
                        <option value="inativo">Inativo (Descontinuado)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Grupo 3: Precificação & Custos */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-wide uppercase">
                      3. Valores & Custos
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Preço Unitário de Venda */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <DollarSign size={13} className="text-emerald-500" />
                        Preço Unitário (Venda / Reposição)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">R$</span>
                        <input 
                          name="price" 
                          type="number" 
                          step="0.01" 
                          min="0"
                          defaultValue={selectedProduct?.price ?? ''} 
                          placeholder="0,00"
                          className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums outline-none focus:border-blue-600 transition-colors" 
                        />
                      </div>
                    </div>

                    {/* Mão de Obra / Custo de Instalação */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Wrench size={13} className="text-zinc-400" />
                        Mão de Obra Estimada (Oficina)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">R$</span>
                        <input 
                          name="laborCost" 
                          type="number" 
                          step="0.01" 
                          min="0"
                          defaultValue={selectedProduct?.laborCost ?? ''} 
                          placeholder="0,00"
                          className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-mono font-bold text-zinc-900 dark:text-white tabular-nums outline-none focus:border-blue-600 transition-colors" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grupo 4: Imagem & Mídia */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-wide uppercase">
                      4. Mídia do Produto
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <ImageIcon size={13} className="text-zinc-400" />
                        URL da Imagem / Foto
                      </label>
                      <input 
                        name="imageUrl" 
                        value={formImageUrl} 
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        placeholder="https://exemplo.com/foto-produto.jpg" 
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-medium text-zinc-900 dark:text-white outline-none focus:border-blue-600 transition-colors" 
                      />
                    </div>

                    {/* Preview Thumbnail */}
                    <div className="w-14 h-14 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative group">
                      {formImageUrl ? (
                        <>
                          <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => setFormImageUrl('')}
                            className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remover imagem"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <ImageIcon size={20} className="text-zinc-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Grupo 5: Dossiê Técnico & Notas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-wide uppercase">
                      5. Dossiê Técnico & Compatibilidade
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Especificações Técnicas e Aplicações em Veículos
                    </label>
                    <textarea 
                      name="description" 
                      defaultValue={selectedProduct?.description} 
                      placeholder="Ex: Amortecedor pressurizado a gás. Compatível com modelos 2018 a 2023..."
                      className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-normal text-zinc-900 dark:text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors h-24 resize-none" 
                    />
                  </div>
                </div>

              </form>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/90 flex items-center justify-between shrink-0">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedProduct && (
                    <span>Registrado no almoxarifado</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200/80 dark:border-zinc-700 shadow-xs"
                  >
                    Cancelar
                  </button>

                  <button 
                    type="submit" 
                    form="product-form"
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs active:scale-95 transition-all"
                  >
                    <Save size={14} />
                    <span>{selectedProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}</span>
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

       {/* Movement Modal - Refined Enterprise Design */}
       <AnimatePresence>
        {isMovementModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMovementModalOpen(false)}
              className="fixed inset-0"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden z-10"
            >
              <div className="p-5 sm:p-6 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs ${movementType === 'in' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {movementType === 'in' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                      {movementType === 'in' ? 'Registrar Entrada de Estoque' : 'Registrar Saída de Estoque'}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[240px]">
                      {selectedProduct?.name} ({selectedProduct?.sku || 'S/SKU'})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleMovement} className="p-5 sm:p-6 space-y-5 text-xs sm:text-sm">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200/70 dark:border-zinc-700 text-center space-y-1">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Volume da Operação</span>
                  <div className="flex items-center justify-center gap-2">
                    <span className={`text-2xl font-bold font-mono ${movementType === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {movementType === 'in' ? '+' : '-'}
                    </span>
                    <input 
                      name="quantity" 
                      type="number" 
                      min="1" 
                      defaultValue={1}
                      required 
                      autoFocus
                      className="w-24 text-center text-3xl font-bold font-mono text-zinc-900 dark:text-white bg-transparent border-b-2 border-zinc-300 dark:border-zinc-600 outline-none focus:border-blue-600 transition-colors py-1 tabular-nums" 
                    />
                    <span className="text-xs font-semibold text-zinc-400">un</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 pt-1">
                    Saldo atual: <strong>{selectedProduct?.quantity || 0} un</strong>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Justificativa / Ordem de Serviço Destino
                  </label>
                  <textarea 
                    name="reason" 
                    required
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm font-normal text-zinc-900 dark:text-white outline-none focus:border-blue-600 transition-colors h-20 resize-none" 
                    placeholder="Ex: Compra NF 1829 / Requisição para OS #1234" 
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsMovementModalOpen(false)} 
                    className="flex-1 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className={`flex-1 py-2 text-xs font-semibold text-white rounded-lg transition-all shadow-xs active:scale-95 ${
                      movementType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    Confirmar {movementType === 'in' ? 'Entrada' : 'Saída'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal - Refined Enterprise Design */}
      <AnimatePresence>
        {deleteProductConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-zinc-200/80 dark:border-zinc-800"
            >
              <div className="w-12 h-12 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mx-auto mb-4 border border-red-200/60 dark:border-red-900/50">
                <Trash2 size={22} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1.5">
                Excluir Produto?
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
                Esta ação removerá este SKU e seus vínculos cadastrais permanentemente do almoxarifado.
              </p>
              <div className="flex gap-2.5">
                <button 
                  onClick={() => setDeleteProductConfirm(null)}
                  className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await deleteProduct(deleteProductConfirm);
                      toast.success('Produto excluído com sucesso.');
                      setDeleteProductConfirm(null);
                    } catch (err) {
                      toast.error('Erro ao excluir: Vínculos ativos detectados.');
                    }
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <InventoryAISummary 
        products={products} 
        categories={categories} 
        isOpen={isAiSummaryOpen} 
        onClose={() => setIsAiSummaryOpen(false)} 
      />
    </motion.div>
  );
};
