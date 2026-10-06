import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Download, 
  Database, 
  Cloud, 
  Save, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  Car, 
  Briefcase, 
  Smartphone,
  ShieldCheck,
  Moon,
  Sun,
  History,
  Palette,
  Check,
  Volume2,
  VolumeX,
  Tv,
  Monitor,
  Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';

export const SettingsView = ({ handleDownloadProject }: { handleDownloadProject: () => void }) => {
  const { 
    settings, 
    updateSettings, 
    themePreference,
    setThemePreference,
    darkMode, 
    toggleDarkMode,
    playLowStockAlertSound,
    handleBackupToDrive,
    handleRestoreFromDrive
  } = useApp();

  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingColor, setIsApplyingColor] = useState(false);
  const [form, setForm] = useState(settings);

  // Sync form when settings load from Firestore or change
  React.useEffect(() => {
    if (settings) {
      setForm(prev => ({
        ...prev,
        ...settings,
        accentColor: settings.accentColor || prev.accentColor || '#3b82f6'
      }));
    }
  }, [settings]);

  const handleApplyColor = async (colorHex: string) => {
    setIsApplyingColor(true);
    try {
      setForm(prev => ({ ...prev, accentColor: colorHex }));
      await updateSettings({ accentColor: colorHex });
      toast.success('Cor de destaque aplicada com sucesso!');
    } catch (error: any) {
      console.error('Error applying accent color:', error);
      toast.error('Erro ao aplicar cor: ' + (error?.message || 'Erro ao salvar'));
    } finally {
      setIsApplyingColor(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Clean form to prevent unsupported undefined values in Firestore
      const cleanForm: Partial<typeof form> = {};
      for (const [key, value] of Object.entries(form)) {
        if (value !== undefined) {
          cleanForm[key as keyof typeof form] = value;
        }
      }
      await updateSettings(cleanForm);
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar: ' + (error?.message || 'Erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase">Configurações Gerais</h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold mt-1">Personalize a identidade e o comportamento do seu Munago Estoque.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="submit" 
            form="settings-form"
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-600/30 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Database size={18} className="animate-pulse" /> : <Save size={18} />}
            Salvar Alterações
          </button>
        </div>
      </div>

      <form id="settings-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lado Esquerdo: Identidade */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-8 rounded-[3rem] shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-blue-600/5 group-hover:scale-110 transition-transform">
              <Car size={160} />
            </div>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Identidade Corporativa</h3>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Nome da Oficina / Loja</label>
                <input 
                  type="text"
                  value={form.storeName || ''}
                  onChange={e => setForm({...form, storeName: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-700 rounded-2xl py-4 px-5 text-zinc-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                  placeholder="Ex: Auto Center São Paulo"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Telefone de Contato</label>
                  <input 
                    type="text"
                    value={form.contactPhone || ''}
                    onChange={e => setForm({...form, contactPhone: e.target.value})}
                    className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-700 rounded-2xl py-4 px-5 text-zinc-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">E-mail Comercial</label>
                  <input 
                    type="email"
                    value={form.contactEmail || ''}
                    onChange={e => setForm({...form, contactEmail: e.target.value})}
                    className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-700 rounded-2xl py-4 px-5 text-zinc-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                    placeholder="contato@empresa.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Endereço Físico</label>
                <textarea 
                  value={form.address || ''}
                  onChange={e => setForm({...form, address: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-700 rounded-2xl py-4 px-5 text-zinc-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all resize-none"
                  rows={3}
                  placeholder="Av. das Américas, 1000 - São Paulo, SP"
                />
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 dark:bg-blue-600 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4 flex items-center gap-3">
              <Download size={24} /> Backup & Versão
            </h3>
            <p className="text-white/60 text-sm font-medium mb-8 leading-relaxed">Baixe uma cópia completa do código fonte do projeto para seu computador.</p>
            <button 
              type="button"
              onClick={handleDownloadProject}
              className="w-full py-4 bg-white text-zinc-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-100 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
            >
              <Database size={18} />
              Exportar Source Code (.ZIP)
            </button>
          </div>
        </div>

        {/* Lado Direito: Comportamento & Cloud */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-8 rounded-[3rem] shadow-xl overflow-hidden relative">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl">
                  {darkMode ? <Moon size={24} className="text-blue-500" /> : <Sun size={24} className="text-amber-500" />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Aparência & Tema</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold mt-0.5">Seletor de modo claro/escuro com sincronização global no HTML</p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <span className={`w-2 h-2 rounded-full ${darkMode ? 'bg-blue-500' : 'bg-amber-500'}`} />
                <span>HTML: <code className="font-mono text-[11px]">{darkMode ? '.dark' : '.light'}</code></span>
              </div>
            </div>

            <div className="space-y-6">
              {/* Seletor de 3 Modos: Claro, Escuro e Sistema */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">
                  Preferência de Exibição
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Modo Claro */}
                  <button
                    type="button"
                    onClick={() => {
                      setThemePreference('light');
                      toast.success('Modo Claro ativado');
                    }}
                    className={`relative p-4 rounded-2xl border text-left transition-all group flex flex-col justify-between gap-3 ${
                      themePreference === 'light'
                        ? 'bg-amber-50/60 dark:bg-zinc-800/90 border-amber-500 dark:border-amber-400 ring-2 ring-amber-500/20 shadow-md'
                        : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={`p-2.5 rounded-xl ${themePreference === 'light' ? 'bg-amber-500 text-white shadow-xs' : 'bg-zinc-200/70 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'}`}>
                        <Sun size={18} />
                      </div>
                      {themePreference === 'light' && (
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div>
                      <h5 className="font-black text-zinc-900 dark:text-white text-xs uppercase tracking-wider">Modo Claro</h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 leading-snug">
                        Interface limpa com fundo branco e contraste solar
                      </p>
                    </div>
                  </button>

                  {/* Modo Escuro */}
                  <button
                    type="button"
                    onClick={() => {
                      setThemePreference('dark');
                      toast.success('Modo Escuro ativado');
                    }}
                    className={`relative p-4 rounded-2xl border text-left transition-all group flex flex-col justify-between gap-3 ${
                      themePreference === 'dark'
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20 shadow-md'
                        : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={`p-2.5 rounded-xl ${themePreference === 'dark' ? 'bg-blue-600 text-white shadow-xs' : 'bg-zinc-200/70 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'}`}>
                        <Moon size={18} />
                      </div>
                      {themePreference === 'dark' && (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div>
                      <h5 className="font-black text-zinc-900 dark:text-white text-xs uppercase tracking-wider">Modo Escuro</h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 leading-snug">
                        Tons escuros zinc-950 para redução do cansaço visual
                      </p>
                    </div>
                  </button>

                  {/* Automático / Sistema */}
                  <button
                    type="button"
                    onClick={() => {
                      setThemePreference('system');
                      toast.success('Sincronização com o sistema ativada');
                    }}
                    className={`relative p-4 rounded-2xl border text-left transition-all group flex flex-col justify-between gap-3 ${
                      themePreference === 'system'
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-600 dark:border-emerald-500 ring-2 ring-emerald-600/20 shadow-md'
                        : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className={`p-2.5 rounded-xl ${themePreference === 'system' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-zinc-200/70 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'}`}>
                        <Monitor size={18} />
                      </div>
                      {themePreference === 'system' && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div>
                      <h5 className="font-black text-zinc-900 dark:text-white text-xs uppercase tracking-wider">Automático</h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 leading-snug">
                        Segue o tema configurado no seu sistema operacional
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Interruptor Rápido de Alternância */}
              <div className="flex items-center justify-between p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                    <span>Alternar Rápido ({darkMode ? 'Escuro Ativo' : 'Claro Ativo'})</span>
                    {themePreference === 'system' && (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-md text-[10px] font-bold">
                        Auto (OS)
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    A preferência é salva localmente e aplicada de forma instantânea em toda a aplicação.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={toggleDarkMode}
                  className={`w-14 h-8 rounded-full transition-all relative shrink-0 ${darkMode ? 'bg-blue-600' : 'bg-zinc-300'}`}
                  title={darkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md flex items-center justify-center text-[10px] ${darkMode ? 'left-7 text-blue-600' : 'left-1 text-zinc-700'}`}>
                    {darkMode ? <Moon size={12} /> : <Sun size={12} />}
                  </div>
                </button>
              </div>

              {/* Alertas Sonoros de Estoque Baixo */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-700 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-zinc-900 dark:text-white uppercase tracking-tight text-sm flex items-center gap-2">
                      {form.enableSoundAlerts !== false ? <Volume2 size={16} className="text-blue-600" /> : <VolumeX size={16} className="text-zinc-400" />}
                      Alertas Sonoros Suaves
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      Estoque Mínimo
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                    Toca um sinal sonoro harmônico e discreto sempre que um produto atinge ou ultrapassa o nível mínimo de estoque.
                  </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      playLowStockAlertSound();
                      toast.info('Demonstração do toque de alerta sonoro reproduzida.', { icon: '🔔' });
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all shadow-xs active:scale-95"
                    title="Ouvir teste do som de aviso"
                  >
                    <Volume2 size={13} className="text-blue-600" />
                    Ouvir Teste
                  </button>

                  <button 
                    type="button"
                    onClick={async () => {
                      const next = form.enableSoundAlerts === false;
                      setForm(prev => ({ ...prev, enableSoundAlerts: next }));
                      await updateSettings({ enableSoundAlerts: next });
                      if (next) {
                        playLowStockAlertSound();
                        toast.success('Alertas sonoros ativados!');
                      } else {
                        toast.info('Alertas sonoros desativados.');
                      }
                    }}
                    className={`w-14 h-8 rounded-full transition-all relative shrink-0 ${form.enableSoundAlerts !== false ? 'bg-blue-600' : 'bg-zinc-300'}`}
                    title={form.enableSoundAlerts !== false ? 'Desativar avisos sonoros' : 'Ativar avisos sonoros'}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${form.enableSoundAlerts !== false ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              {/* Auto-Scroll no Modo Monitor (Painel de Parede) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-700">
                <div className="space-y-1">
                  <h4 className="font-black text-zinc-900 dark:text-white uppercase tracking-tight text-sm flex items-center gap-2">
                    <Tv size={16} className="text-blue-600" />
                    Auto-Scroll no Modo Monitor (Painéis de Parede)
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                    Alterna e rola suavemente entre os widgets do dashboard automaticamente quando o Modo Monitor estiver ligado.
                  </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs">
                    {[
                      { label: '8s', val: 8 },
                      { label: '12s', val: 12 },
                      { label: '20s', val: 20 },
                      { label: '30s', val: 30 }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={async () => {
                          setForm(prev => ({ ...prev, monitorScrollIntervalSeconds: opt.val }));
                          await updateSettings({ monitorScrollIntervalSeconds: opt.val });
                          toast.success(`Intervalo do auto-scroll ajustado para ${opt.val}s`);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                          (form.monitorScrollIntervalSeconds || 12) === opt.val
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <button 
                    type="button"
                    onClick={async () => {
                      const next = form.monitorAutoScrollEnabled === false;
                      setForm(prev => ({ ...prev, monitorAutoScrollEnabled: next }));
                      await updateSettings({ monitorAutoScrollEnabled: next });
                      if (next) {
                        toast.success('Auto-scroll ativado para o Modo Monitor!');
                      } else {
                        toast.info('Auto-scroll desativado no Modo Monitor.');
                      }
                    }}
                    className={`w-14 h-8 rounded-full transition-all relative shrink-0 ${form.monitorAutoScrollEnabled !== false ? 'bg-blue-600' : 'bg-zinc-300'}`}
                    title={form.monitorAutoScrollEnabled !== false ? 'Desativar auto-scroll no Modo Monitor' : 'Ativar auto-scroll no Modo Monitor'}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${form.monitorAutoScrollEnabled !== false ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-zinc-900 dark:text-white uppercase tracking-tight text-sm flex items-center gap-2">
                      <Palette size={16} className="text-blue-600" />
                      Cor de Destaque
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold mt-1">
                      Escolha a cor principal para botões, indicadores e elementos da interface.
                    </p>
                  </div>
                  {/* Visual preview swatch */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    <span 
                      className="w-4 h-4 rounded-full border border-black/10 inline-block shadow-inner"
                      style={{ backgroundColor: form.accentColor || '#3b82f6' }}
                    />
                    <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300 uppercase">
                      {form.accentColor || '#3b82f6'}
                    </span>
                  </div>
                </div>

                {/* Swatches Grid */}
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {[
                    { name: 'Azul Munago (Padrão)', hex: '#3b82f6' },
                    { name: 'Azul Real', hex: '#2563eb' },
                    { name: 'Índigo Noturno', hex: '#4f46e5' },
                    { name: 'Violeta / Roxo', hex: '#9333ea' },
                    { name: 'Fúcsia Vibrante', hex: '#d946ef' },
                    { name: 'Rosa Carmim', hex: '#db2777' },
                    { name: 'Vermelho Intenso', hex: '#dc2626' },
                    { name: 'Laranja Elétrico', hex: '#ea580c' },
                    { name: 'Âmbar Dourado', hex: '#d97706' },
                    { name: 'Verde Esmeralda', hex: '#16a34a' },
                    { name: 'Verde Menta', hex: '#059669' },
                    { name: 'Ciano Oceano', hex: '#0891b2' },
                    { name: 'Grafite Moderno', hex: '#4b5563' },
                  ].map(color => {
                    const isSelected = (form.accentColor?.toLowerCase() === color.hex.toLowerCase());
                    return (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, accentColor: color.hex });
                        }}
                        className={`w-9 h-9 rounded-full transition-all flex items-center justify-center border-2 border-white/20 shadow-sm relative ${isSelected ? 'ring-4 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-800 scale-110 shadow-lg z-10' : 'hover:scale-110 opacity-90 hover:opacity-100'}`}
                        style={{ backgroundColor: color.hex, '--tw-ring-color': color.hex } as React.CSSProperties}
                        title={color.name}
                      >
                        {isSelected && <Check size={14} className="text-white drop-shadow-md stroke-[3]" />}
                      </button>
                    );
                  })}

                  {/* Custom Color Picker input */}
                  <label 
                    className="w-9 h-9 rounded-full transition-all flex items-center justify-center border-2 border-dashed border-zinc-400 dark:border-zinc-600 hover:border-zinc-900 dark:hover:border-white cursor-pointer bg-white dark:bg-zinc-800 shadow-sm hover:scale-110"
                    title="Escolher cor personalizada"
                  >
                    <input 
                      type="color"
                      value={form.accentColor?.startsWith('#') && form.accentColor.length === 7 ? form.accentColor : '#3b82f6'}
                      onChange={e => setForm({ ...form, accentColor: e.target.value })}
                      className="sr-only"
                    />
                    <Palette size={14} className="text-zinc-600 dark:text-zinc-300" />
                  </label>
                </div>

                {/* Bottom Action & Preview */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Prévia:</span>
                    <span 
                      className="text-xs font-black px-3 py-1 text-white rounded-lg shadow-sm transition-colors duration-300"
                      style={{ backgroundColor: form.accentColor || '#3b82f6' }}
                    >
                      Botão de Ação
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyColor(form.accentColor || '#3b82f6')}
                    disabled={isApplyingColor}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-md active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: form.accentColor || '#3b82f6' }}
                  >
                     {isApplyingColor ? <Database size={14} className="animate-pulse" /> : <Save size={14} />}
                     {isApplyingColor ? 'Aplicando...' : 'Aplicar Cor'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 p-6 bg-amber-50/30 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/20">
                <h4 className="font-black text-amber-800 dark:text-amber-500 uppercase tracking-tight text-sm">Avisos Críticos</h4>
                <div className="flex items-center gap-4 mt-4">
                   <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-xl flex items-center justify-center text-amber-500 shadow-sm">
                     <Settings size={24} />
                   </div>
                   <p className="text-xs font-bold text-amber-800/70 dark:text-amber-500/70 leading-relaxed italic">
                     "As configurações de alertas estão vindo em breve com personalização de níveis por categoria."
                   </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-8 rounded-[3rem] shadow-xl overflow-hidden relative">
             <div className="absolute top-0 right-0 p-8 text-green-600/5">
              <Cloud size={160} />
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-2xl">
                <Cloud size={24} />
              </div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Sincronização Nuvem & Backups</h3>
            </div>

            <div className="space-y-6 relative z-10">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-800/80 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                Utilize o **Google Drive** para manter backups seguros e externos de forma manual.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  type="button" 
                  onClick={handleBackupToDrive}
                  className="flex items-center justify-center gap-3 p-5 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-3xl font-black text-xs uppercase tracking-widest text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-95"
                >
                  <Cloud size={18} className="text-blue-600" />
                  Backup Drive
                </button>
                <button 
                  type="button" 
                  onClick={handleRestoreFromDrive}
                  className="flex items-center justify-center gap-3 p-5 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-3xl font-black text-xs uppercase tracking-widest text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-95"
                >
                  <History size={18} className="text-green-600" />
                  Restaurar
                </button>
              </div>

              <div className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-100 dark:border-zinc-700 mt-6">
                <div className="pr-4">
                  <h4 className="font-black text-zinc-900 dark:text-white uppercase tracking-tight text-sm">Automático no Firestore</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold mt-1">
                    Gera um snapshot diário internamente no banco de dados.
                  </p>
                  {form.lastFirestoreBackup && (
                    <p className="text-[10px] text-zinc-400 font-medium mt-2">
                       Último: {new Date(form.lastFirestoreBackup).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <button 
                  type="button"
                  onClick={() => setForm({ ...form, autoBackupEnabled: !form.autoBackupEnabled })}
                  className={`w-14 h-8 rounded-full transition-all relative shrink-0 ${form.autoBackupEnabled ? 'bg-green-600' : 'bg-zinc-300'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${form.autoBackupEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
