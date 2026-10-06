import React, { useState, useEffect } from 'react';
import { Tag, X, Sparkles, Trash2, Edit2, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp, Category } from '../context/AppContext';
import { toast } from 'sonner';
import { authFetch } from '../lib/api';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose }) => {
  const { categories, addCategory, updateCategory, deleteCategory } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);

  useEffect(() => {
    if (selectedCategory) {
      setName(selectedCategory.name);
      setDescription(selectedCategory.description || '');
      setImageUrl(selectedCategory.imageUrl || '');
      setAiSuggestion(selectedCategory.aiSuggestion || '');
      setIsEditing(true);
    } else {
      resetForm();
    }
  }, [selectedCategory]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setImageUrl('');
    setAiSuggestion('');
    setIsEditing(false);
    setSelectedCategory(null);
  };

  const handleGenerateAI = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome da categoria primeiro.');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Consultando a IA para ícone e sugestão...');
    
    try {
      // 1. Generate Image (Icon)
      const imageRes = await authFetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Crie um ícone minimalista, profissional e moderno para a categoria "${name}". O ícone deve representar o tema de forma limpa, com cores sólidas e fundo neutro, adequado para um painel de gestão de inventário.`,
          config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
        })
      });
      const imageData = await imageRes.json();
      
      if (imageData.image) {
        setImageUrl(`data:${imageData.image.mimeType};base64,${imageData.image.data}`);
      }

      // 2. Generate Suggestion
      const suggestionRes = await authFetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Com base na categoria "${name}", sugira um nome estratégico (curto) e uma breve recomendação organizacional (máximo 15 palavras) para melhorar o inventário. Responda em português.` }] }],
          config: { temperature: 0.7 }
        })
      });
      const suggestionData = await suggestionRes.json();
      
      if (suggestionData.text) {
        setAiSuggestion(suggestionData.text);
      }

      toast.success('Conteúdo gerado com sucesso!', { id: toastId });
    } catch (error) {
      console.error('AI Error:', error);
      toast.error('Erro ao gerar conteúdo com IA.', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && selectedCategory) {
        await updateCategory(selectedCategory.id, { name, description, imageUrl, aiSuggestion });
      } else {
        await addCategory({ name, description, imageUrl, aiSuggestion });
      }
      resetForm();
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row"
      >
        {/* Left Side: List of Categories */}
        <div className="w-full md:w-5/12 border-r border-zinc-100 dark:border-zinc-800 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Tag className="text-blue-600" size={20} />
              Categorias
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{categories.length} categorias cadastradas</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {categories.map((cat) => (
              <motion.div 
                key={cat.id}
                layout
                onClick={() => setSelectedCategory(cat)}
                className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${
                  selectedCategory?.id === cat.id 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-900/50 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border ${
                    selectedCategory?.id === cat.id ? 'bg-white/20 border-white/30' : 'bg-zinc-100 dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600'
                  }`}>
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Tag size={18} className={selectedCategory?.id === cat.id ? 'text-white' : 'text-zinc-400'} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${selectedCategory?.id === cat.id ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
                      {cat.name}
                    </p>
                    <p className={`text-[10px] truncate ${selectedCategory?.id === cat.id ? 'text-blue-100' : 'text-zinc-500'}`}>
                      {cat.description || 'Sem descrição'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(cat); }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      selectedCategory?.id === cat.id 
                        ? 'hover:bg-white/20 text-white' 
                        : 'text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
            
            {categories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400">
                <Tag size={40} strokeWidth={1} className="mb-2 opacity-20" />
                <p className="text-sm font-medium">Nenhuma categoria</p>
              </div>
            )}
          </div>
          
          <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
            <button 
              onClick={resetForm}
              className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
            >
              <Plus size={18} />
              Nova Categoria
            </button>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
              {isEditing ? 'Editar Categoria' : 'Criar Nova Categoria'}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all text-zinc-400">
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Nome da Categoria</label>
                <div className="flex gap-2">
                  <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Ex: Pneus, Acessórios..."
                    className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={isGenerating || !name.trim()}
                    className="px-4 bg-blue-600 text-white rounded-2xl flex items-center gap-2 font-bold hover:bg-blue-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                  >
                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    <span className="hidden sm:inline">IA Assist</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Descrição</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o propósito desta categoria..."
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all dark:text-white min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Ícone da Categoria</label>
                  <div className="space-y-3">
                    <input 
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="URL da imagem ou ícone"
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all dark:text-white text-sm"
                    />
                    <div className="w-32 h-32 mx-auto rounded-3xl overflow-hidden border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center group relative">
                      {imageUrl ? (
                        <>
                          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            type="button" 
                            onClick={() => setImageUrl('')}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <Tag size={24} className="mx-auto text-zinc-300 mb-1" />
                          <p className="text-[10px] text-zinc-400 font-medium leading-tight">Preview do ícone</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Sugestão da IA</label>
                  <div className={`p-4 rounded-2xl border min-h-[160px] flex flex-col ${
                    aiSuggestion 
                      ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' 
                      : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-700 border-dashed'
                  }`}>
                    {aiSuggestion ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Recomendação Estratégica</span>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 italic leading-relaxed">
                          {aiSuggestion}
                        </p>
                        <button 
                          type="button"
                          onClick={() => setAiSuggestion('')}
                          className="mt-auto self-end text-[10px] font-bold text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          Remover sugestão
                        </button>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                        <Sparkles size={24} className="mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Sem sugestão</p>
                        <p className="text-[10px] mt-1">Use o botão "IA Assist" acima para preencher</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 pt-4">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-4 px-6 rounded-2xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
                >
                  Descartar Alterações
                </button>
              )}
              <button
                type="submit"
                className="flex-[2] py-4 px-6 rounded-2xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 active:scale-95"
              >
                {isEditing ? 'Salvar Alterações' : 'Criar Categoria'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>

      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center border border-zinc-100 dark:border-zinc-800"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Excluir Categoria?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                Deseja realmente remover a categoria <strong>{deleteConfirm.name}</strong>? Esta ação não afetará os produtos já existentes, mas desvinculará a categoria.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDelete(deleteConfirm.id)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/30"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryManager;
