import React, { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  Save,
  Moon,
  Sun,
  Monitor,
  History,
  Palette,
  Check,
  Volume2,
  Loader2,
  Store,
  Percent,
  Bell,
  Database,
  Link2,
  Unlink,
  Settings as SettingsIcon
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHero, heroBtnPrimary } from '../components/PageHero';
import { toast } from 'sonner';
import { apiDelete, apiGet } from '../lib/api';
import { useGoogleAuth } from '../hooks/useGoogleAuth';

interface DriveStatus { configured: boolean; connected: boolean; email: string | null }

const ACCENT_COLORS = [
  { name: 'Azul Munago (padrão)', hex: '#3b82f6' },
  { name: 'Azul real', hex: '#2563eb' },
  { name: 'Índigo', hex: '#4f46e5' },
  { name: 'Violeta', hex: '#9333ea' },
  { name: 'Fúcsia', hex: '#d946ef' },
  { name: 'Rosa', hex: '#db2777' },
  { name: 'Vermelho', hex: '#dc2626' },
  { name: 'Laranja', hex: '#ea580c' },
  { name: 'Âmbar', hex: '#d97706' },
  { name: 'Verde', hex: '#16a34a' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Ciano', hex: '#0891b2' },
  { name: 'Grafite', hex: '#4b5563' },
];

// Campos de texto que só são gravados ao clicar em "Salvar"
const FORM_KEYS = ['storeName', 'contactPhone', 'contactEmail', 'address', 'asaasWalletId'] as const;

const fieldClass =
  'w-full rounded-lg border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none transition-colors focus:border-blue-600 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-blue-600/20';

const secondaryBtn =
  'inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-60 cursor-pointer';

const Section: React.FC<{ id: string; icon: React.ElementType; title: string; description: string; children: React.ReactNode }> = ({ id, icon: Icon, title, description, children }) => (
  <section aria-labelledby={id} className="bg-white dark:bg-zinc-900/90 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs overflow-hidden">
    <header className="flex items-center gap-2.5 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
      <span className="p-1.5 rounded-lg border bg-white dark:bg-zinc-800 border-zinc-200/70 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
        <Icon size={14} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={description}>{description}</p>
      </div>
    </header>
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
      {children}
    </div>
  </section>
);

const Row: React.FC<{ title: string; description?: React.ReactNode; children?: React.ReactNode; htmlFor?: string }> = ({ title, description, children, htmlFor }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5">
    <div className="min-w-0">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-900 dark:text-white">{title}</label>
      ) : (
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{title}</p>
      )}
      {description && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
    </div>
    {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
  </div>
);

const Switch: React.FC<{ checked: boolean; onChange: () => void; label: string; disabled?: boolean }> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    disabled={disabled}
    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 disabled:opacity-60 cursor-pointer ${checked ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
  >
    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
  </button>
);

export const SettingsView = () => {
  const {
    settings,
    updateSettings,
    themePreference,
    setThemePreference,
    playLowStockAlertSound,
    handleBackupToDrive,
    handleRestoreFromDrive
  } = useApp();

  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingColor, setIsApplyingColor] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [form, setForm] = useState(settings);

  // Conexão com o Google Drive (tokens ficam no servidor; aqui só o status).
  const { openGoogleAuth, isLoading: isConnectingDrive } = useGoogleAuth();
  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const loadDrive = useCallback(() => {
    apiGet<DriveStatus>('/google/status')
      .then(setDrive)
      .catch(() => setDrive({ configured: false, connected: false, email: null }));
  }, []);
  useEffect(() => {
    loadDrive();
    // Ao voltar do popup do Google (ou de outra aba), atualiza o status.
    window.addEventListener('focus', loadDrive);
    return () => window.removeEventListener('focus', loadDrive);
  }, [loadDrive]);

  const disconnectDrive = async () => {
    if (!window.confirm('Desconectar a conta Google? Os backups já enviados continuam no seu Drive.')) return;
    setDisconnecting(true);
    try {
      await apiDelete('/google/connection');
      toast.success('Conta Google desconectada.');
      loadDrive();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível desconectar.');
    } finally {
      setDisconnecting(false);
    }
  };

  // Sincroniza quando as configurações chegam do servidor ou mudam
  React.useEffect(() => {
    if (settings) {
      setForm(prev => ({
        ...prev,
        ...settings,
        accentColor: settings.accentColor || prev.accentColor || '#3b82f6'
      }));
    }
  }, [settings]);

  const isDirty = FORM_KEYS.some(k => (form as any)[k] !== (settings as any)?.[k]);
  const accent = form.accentColor || '#3b82f6';
  const accentChanged = accent.toLowerCase() !== (settings?.accentColor || '#3b82f6').toLowerCase();

  /** Interruptores salvam na hora; se falhar, volta o valor anterior. */
  const saveNow = async (key: string, patch: Partial<typeof form>, okMsg: string) => {
    const previous = form;
    setForm(prev => ({ ...prev, ...patch }));
    setSavingKey(key);
    try {
      await updateSettings(patch);
      toast.success(okMsg);
      return true;
    } catch (error: any) {
      console.error('Error saving setting:', error);
      setForm(previous);
      toast.error('Não foi possível salvar: ' + (error?.message || 'erro desconhecido'));
      return false;
    } finally {
      setSavingKey(null);
    }
  };

  const handleApplyColor = async () => {
    setIsApplyingColor(true);
    try {
      await updateSettings({ accentColor: accent });
      toast.success('Cor de destaque aplicada.');
    } catch (error: any) {
      console.error('Error applying accent color:', error);
      toast.error('Erro ao aplicar cor: ' + (error?.message || 'erro ao salvar'));
    } finally {
      setIsApplyingColor(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      FORM_KEYS.forEach(k => {
        const v = (form as any)[k];
        if (v !== undefined) patch[k] = v;
      });
      await updateSettings(patch as Partial<typeof form>);
      toast.success('Configurações salvas.');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar: ' + (error?.message || 'erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  const soundOn = form.enableSoundAlerts !== false;
  const autoScrollOn = form.monitorAutoScrollEnabled !== false;

  return (
    <div className="w-full space-y-4 pb-24 lg:pb-6">
      {/* Topo */}
      <PageHero
        icon={SettingsIcon}
        title="Configurações"
        subtitle="Dados da oficina, recebimentos, aparência, alertas e backups."
        actions={<>
          {isDirty && <span className="rounded-full border border-amber-300/50 bg-amber-400/20 px-2.5 py-1 text-xs font-medium text-amber-100">Alterações não salvas</span>}
          <button type="submit" form="settings-form" disabled={isSaving || !isDirty} className={heroBtnPrimary}>
            {isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {isSaving ? 'Salvando…' : 'Salvar'}
          </button>
        </>}
      />

      <form id="settings-form" onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
        {/* Oficina */}
        <Section id="sec-store" icon={Store} title="Oficina" description="Aparece no menu, nos relatórios em PDF e nas ordens de serviço.">
          <div className="p-4 space-y-3">
            <div className="space-y-1">
              <label htmlFor="store-name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome da oficina</label>
              <input
                id="store-name"
                type="text"
                value={form.storeName || ''}
                onChange={e => setForm({ ...form, storeName: e.target.value })}
                className={fieldClass}
                placeholder="Auto Center São Paulo"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="store-phone" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Telefone</label>
                <input
                  id="store-phone"
                  type="tel"
                  inputMode="tel"
                  value={form.contactPhone || ''}
                  onChange={e => setForm({ ...form, contactPhone: e.target.value })}
                  className={fieldClass}
                  placeholder="(11) 98765-4321"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="store-email" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">E-mail</label>
                <input
                  id="store-email"
                  type="email"
                  value={form.contactEmail || ''}
                  onChange={e => setForm({ ...form, contactEmail: e.target.value })}
                  className={fieldClass}
                  placeholder="contato@oficina.com"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="store-address" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Endereço</label>
              <textarea
                id="store-address"
                value={form.address || ''}
                onChange={e => setForm({ ...form, address: e.target.value })}
                // Cresce com o texto (field-sizing); onde não há suporte, mostra 2 linhas.
                className={`${fieldClass} resize-none field-sizing-content min-h-[4.25rem] max-h-40 leading-relaxed`}
                rows={2}
                placeholder="Av. das Américas, 1000 - São Paulo, SP"
              />
            </div>
          </div>
        </Section>

        {/* Financeiro */}
        <Section id="sec-finance" icon={Percent} title="Recebimentos" description="Para onde vai a parte da mecânica nas cobranças. O repasse para a empresa é definido em cada serviço, na tela Serviços.">
          <div className="px-4 py-3 space-y-1">
            <label htmlFor="asaas-wallet" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Carteira Asaas da mecânica</label>
            <input
              id="asaas-wallet"
              value={form.asaasWalletId || ''}
              onChange={e => setForm({ ...form, asaasWalletId: e.target.value.trim() })}
              maxLength={100}
              spellCheck={false}
              autoComplete="off"
              placeholder="ex.: 0a1b2c3d-..."
              className={`${fieldClass} max-w-md font-mono`}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Identificador da carteira (walletId) da conta Asaas no CNPJ da mecânica. Nas cobranças, a parte da oficina cai direto nela.
            </p>
          </div>
        </Section>

        {/* Backup e dados */}
        <Section id="sec-backup" icon={Database} title="Backup e dados" description="Cópias de segurança do estoque, OS e movimentações.">
          <Row
            title="Backup automático diário"
            description={
              form.lastFirestoreBackup
                ? `Último backup: ${new Date(form.lastFirestoreBackup).toLocaleString('pt-BR')}`
                : 'Gera uma cópia por dia no banco de dados.'
            }
          >
            <Switch
              checked={Boolean(form.autoBackupEnabled)}
              disabled={savingKey === 'autobackup'}
              label="Backup automático diário"
              onChange={() => saveNow('autobackup', { autoBackupEnabled: !form.autoBackupEnabled }, !form.autoBackupEnabled ? 'Backup automático ativado.' : 'Backup automático desativado.')}
            />
          </Row>
          <Row
            title="Google Drive"
            description={
              <span className="flex flex-col gap-1">
                <span>Envie uma cópia manual para o seu Drive ou restaure a partir dela.</span>
                <span className="flex items-center gap-1.5" aria-live="polite">
                  {!drive ? (
                    <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Verificando conexão…</>
                  ) : !drive.configured ? (
                    <><span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" /> Google não configurado no servidor.</>
                  ) : drive.connected ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">Conectado</span>
                      {drive.email && <span className="truncate">· {drive.email}</span>}
                    </>
                  ) : (
                    <><span className="h-2 w-2 rounded-full bg-zinc-400" aria-hidden="true" /> Não conectado</>
                  )}
                </span>
              </span>
            }
          >
            {drive?.connected ? (
              <>
                <button type="button" onClick={handleBackupToDrive} className={secondaryBtn}>
                  <Cloud size={14} className="text-blue-600" aria-hidden="true" /> Fazer backup
                </button>
                <button type="button" onClick={handleRestoreFromDrive} className={secondaryBtn}>
                  <History size={14} className="text-emerald-600" aria-hidden="true" /> Restaurar
                </button>
                <button
                  type="button"
                  onClick={disconnectDrive}
                  disabled={disconnecting}
                  aria-label="Desconectar conta Google"
                  title="Desconectar conta Google"
                  className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-950/40 cursor-pointer"
                >
                  {disconnecting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Unlink size={14} aria-hidden="true" />}
                </button>
              </>
            ) : drive?.configured ? (
              <button type="button" onClick={() => openGoogleAuth('drive')} disabled={isConnectingDrive} className={secondaryBtn}>
                {isConnectingDrive ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Link2 size={14} className="text-blue-600" aria-hidden="true" />}
                Conectar Google Drive
              </button>
            ) : null}
          </Row>
        </Section>
        </div>

        <div className="space-y-4">
        {/* Aparência */}
        <Section id="sec-appearance" icon={Palette} title="Aparência" description="Tema e cor de destaque. O tema vale só para este navegador; a cor vale para todos.">
          <Row title="Tema">
            <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-700" role="radiogroup" aria-label="Tema">
              {([
                ['light', 'Claro', Sun],
                ['dark', 'Escuro', Moon],
                ['system', 'Automático', Monitor],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={themePreference === value}
                  onClick={() => setThemePreference(value)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    themePreference === value
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={13} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
          </Row>

          <div className="px-4 py-2.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">Cor de destaque</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Botões e indicadores do sistema.</p>
              </div>
              <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 font-mono text-[11px] text-zinc-600 dark:text-zinc-300 uppercase">
                <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: accent }} aria-hidden="true" />
                {accent}
              </span>
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor de destaque">
              {ACCENT_COLORS.map(color => {
                const selected = accent.toLowerCase() === color.hex.toLowerCase();
                return (
                  <button
                    key={color.hex}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={color.name}
                    title={color.name}
                    onClick={() => setForm({ ...form, accentColor: color.hex })}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 dark:ring-offset-zinc-900 ${selected ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-white scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {selected && <Check size={13} className="text-white" strokeWidth={3} aria-hidden="true" />}
                  </button>
                );
              })}
              <label
                className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-600 hover:border-zinc-500 cursor-pointer"
                title="Cor personalizada"
              >
                <input
                  type="color"
                  aria-label="Cor personalizada"
                  value={accent.startsWith('#') && accent.length === 7 ? accent : '#3b82f6'}
                  onChange={e => setForm({ ...form, accentColor: e.target.value })}
                  className="sr-only"
                />
                <Palette size={13} className="text-zinc-500" aria-hidden="true" />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs font-semibold px-3 py-1.5 text-white rounded-lg" style={{ backgroundColor: accent }}>
                Prévia do botão
              </span>
              <button type="button" onClick={handleApplyColor} disabled={isApplyingColor || !accentChanged} className={secondaryBtn}>
                {isApplyingColor ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                {isApplyingColor ? 'Aplicando…' : accentChanged ? 'Aplicar cor' : 'Cor aplicada'}
              </button>
            </div>
          </div>
        </Section>

        {/* Alertas e monitor */}
        <Section id="sec-alerts" icon={Bell} title="Alertas e Modo Monitor" description="Salvos na hora, para todos os usuários.">
          <Row title="Alerta sonoro de estoque baixo" description="Toca um sinal discreto quando um produto chega ao estoque mínimo.">
            <button
              type="button"
              onClick={() => playLowStockAlertSound()}
              className={secondaryBtn}
              title="Ouvir o som do alerta"
            >
              <Volume2 size={14} aria-hidden="true" /> Ouvir
            </button>
            <Switch
              checked={soundOn}
              disabled={savingKey === 'sound'}
              label="Alerta sonoro de estoque baixo"
              onChange={async () => {
                const next = !soundOn;
                const ok = await saveNow('sound', { enableSoundAlerts: next }, next ? 'Alerta sonoro ativado.' : 'Alerta sonoro desativado.');
                if (ok && next) playLowStockAlertSound();
              }}
            />
          </Row>
          <Row title="Rolagem automática no Modo Monitor" description="No painel de parede, passa sozinho de uma seção para outra.">
            <div className={`flex items-center gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-700 ${autoScrollOn ? '' : 'opacity-50'}`} role="radiogroup" aria-label="Intervalo entre seções">
              {[8, 12, 20, 30].map(sec => {
                const selected = (form.monitorScrollIntervalSeconds || 12) === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!autoScrollOn || savingKey === 'interval'}
                    onClick={() => saveNow('interval', { monitorScrollIntervalSeconds: sec }, `Intervalo ajustado para ${sec}s.`)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold tabular-nums transition-colors cursor-pointer disabled:cursor-not-allowed ${
                      selected ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {sec}s
                  </button>
                );
              })}
            </div>
            <Switch
              checked={autoScrollOn}
              disabled={savingKey === 'autoscroll'}
              label="Rolagem automática no Modo Monitor"
              onChange={() => saveNow('autoscroll', { monitorAutoScrollEnabled: !autoScrollOn }, !autoScrollOn ? 'Rolagem automática ativada.' : 'Rolagem automática desativada.')}
            />
          </Row>
        </Section>
        </div>
      </form>
    </div>
  );
};
