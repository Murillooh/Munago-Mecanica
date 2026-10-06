import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  Sparkles, 
  Palette, 
  Moon, 
  Sun, 
  X, 
  User, 
  Building, 
  Phone, 
  UserPlus, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  ShieldCheck,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { apiPost } from '../lib/api';
import { authErrorMessage, confirmPasswordReset, requestPasswordReset } from '../lib/auth';

// login: e-mail e senha | newPassword: primeiro acesso (senha temporária do convite) | resetCode: código recebido por e-mail
type AuthStep = 'login' | 'newPassword' | 'resetCode';

const inputClass = "w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-4 pl-12 pr-5 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all text-sm font-medium";

const Login: React.FC = () => {
  const {
    loginEmail,
    completeNewPassword,
    darkMode,
    toggleDarkMode
  } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authStep, setAuthStep] = useState<AuthStep>('login');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Form for Access Request
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    workshopName: '',
    phone: '',
    message: ''
  });

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistrationLoading(true);
    try {
      const { phone, message, ...required } = regForm;
      await apiPost('/access-requests', {
        ...required,
        ...(phone ? { phone } : {}),
        ...(message ? { message } : {}),
      });
      setRegistrationSuccess(true);
      toast.success('Solicitação enviada com sucesso!');
    } catch (error) {
      console.error('Error requesting access:', error);
      toast.error(error instanceof Error && error.message ? error.message : 'Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const backToLogin = () => {
    setAuthStep('login');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetCode('');
    setLoginError('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (authStep !== 'login' && newPassword !== confirmNewPassword) {
      setLoginError('As senhas não coincidem.');
      return;
    }

    setIsLoggingIn(true);
    try {
      if (authStep === 'login') {
        const result = await loginEmail(email, password);
        if (result === 'NEW_PASSWORD_REQUIRED') {
          setPassword('');
          setAuthStep('newPassword');
          return;
        }
        toast.success('Login realizado com sucesso!');
      } else if (authStep === 'newPassword') {
        await completeNewPassword(newPassword);
        toast.success('Senha definida! Bem-vindo.');
      } else {
        await confirmPasswordReset(email, resetCode, newPassword);
        backToLogin();
        toast.success('Senha redefinida! Entre com a nova senha.');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setLoginError(authErrorMessage(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setLoginError('Por favor, informe seu e-mail para recuperar a senha.');
      return;
    }
    setLoginError('');
    try {
      await requestPasswordReset(email);
      setAuthStep('resetCode');
      toast.success('Se o e-mail estiver cadastrado, você receberá um código de verificação.');
    } catch (error) {
      setLoginError(authErrorMessage(error));
    }
  };

  const titles: Record<AuthStep, [string, string]> = {
    login: ['Acessar Painel', 'Entre com suas credenciais para continuar'],
    newPassword: ['Defina sua senha', 'Primeiro acesso: crie uma senha pessoal para substituir a temporária'],
    resetCode: ['Redefinir senha', `Digite o código enviado para ${email} e a nova senha`],
  };

  return (
    <div id="login-root-container" className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
      {/* Animated Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

      {/* Theme Toggle Button */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <button
          id="btn-toggle-theme-login"
          type="button"
          onClick={toggleDarkMode}
          aria-label={darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className="p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl hover:scale-110 transition-all text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer"
        >
          {darkMode ? <Sun size={24} className="text-zinc-300" aria-hidden="true" /> : <Moon size={24} aria-hidden="true" />}
          <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">
            {darkMode ? 'Escuro' : 'Claro'}
          </span>
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl lg:min-h-[680px] flex flex-col lg:flex-row items-stretch justify-center gap-0 z-10 bg-zinc-900/50 backdrop-blur-2xl border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]"
      >
        {/* Left Side: Branding & Info */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 p-16 flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 font-black text-xl shadow-xl">ME</div>
              <span className="font-black text-3xl tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">Munago <span className="text-blue-200">Estoque</span></span>
            </div>
            
            <h2 className="text-5xl font-black text-white leading-[1.1] mb-6 drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              Gestão Inteligente <br />
              <span className="text-blue-200">Para sua Oficina.</span>
            </h2>
            <p className="text-blue-50 text-lg font-medium max-w-md leading-relaxed opacity-80">
              Controle de estoque, ordens de serviço e inteligência artificial em uma única plataforma robusta e intuitiva.
            </p>
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4 text-white/90">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/10">
                <ShieldCheck size={20} />
              </div>
              <span className="font-bold">Segurança de nível empresarial</span>
            </div>
            <div className="flex items-center gap-4 text-white/90">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/10">
                <TrendingUp size={20} />
              </div>
              <span className="font-bold">Relatórios e insights em tempo real</span>
            </div>
          </div>

          {/* Floating Character */}
          <motion.img 
            src="https://cdn3d.iconscout.com/3d/premium/thumb/man-standing-with-hand-on-waist-5691550-4741094.png" 
            alt="3D Character" 
            className="absolute bottom-[-50px] right-[-50px] w-[350px] h-auto drop-shadow-[0_35px_35px_rgba(0,0,0,0.5)] pointer-events-none"
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full lg:w-[450px] p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white dark:bg-zinc-900">
          <div className="mb-10">
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">
              {titles[authStep][0]}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">
              {titles[authStep][1]}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4" aria-busy={isLoggingIn}>
            {authStep === 'login' && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="login-email-input" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">E-mail</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600 transition-colors" size={18} aria-hidden="true" />
                    <input
                      id="login-email-input"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="exemplo@email.com"
                      aria-invalid={!!loginError}
                      aria-describedby={loginError ? 'login-error' : undefined}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 font-sans">
                  <label htmlFor="login-password-input" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Senha</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600 transition-colors" size={18} aria-hidden="true" />
                    <input
                      id="login-password-input"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      aria-invalid={!!loginError}
                      aria-describedby={loginError ? 'login-error' : undefined}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex justify-end pr-1">
                    <button
                      id="btn-forgot-password"
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[10px] font-bold text-zinc-400 hover:text-blue-600 transition-colors uppercase tracking-widest cursor-pointer"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                </div>
              </>
            )}

            {authStep === 'resetCode' && (
              <div className="space-y-1.5">
                <label htmlFor="reset-code-input" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Código de verificação</label>
                <div className="relative group">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600 transition-colors" size={18} aria-hidden="true" />
                  <input
                    id="reset-code-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                    placeholder="123456"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {authStep !== 'login' && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="new-password-input" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Nova senha</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600 transition-colors" size={18} aria-hidden="true" />
                    <input
                      id="new-password-input"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="••••••••"
                      aria-describedby="new-password-hint"
                      className={inputClass}
                    />
                  </div>
                  <p id="new-password-hint" className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1">
                    Mínimo de 8 caracteres, com letras minúsculas e números.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="confirm-password-input" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Confirmar nova senha</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600 transition-colors" size={18} aria-hidden="true" />
                    <input
                      id="confirm-password-input"
                      type="password"
                      autoComplete="new-password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>
                </div>
              </>
            )}

            {loginError && (
              <motion.div
                id="login-error"
                role="alert"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-xs font-bold"
              >
                <AlertCircle size={16} aria-hidden="true" />
                <p>{loginError}</p>
              </motion.div>
            )}

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black transition-all transform active:scale-95 shadow-xl shadow-blue-600/20 dark:shadow-blue-500/40 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-widest mt-6 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Aguarde...</span>
                </>
              ) : (
                <>
                  <span>{authStep === 'login' ? 'Entrar no Sistema' : 'Salvar nova senha'}</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </>
              )}
            </button>

            {authStep !== 'login' && (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={backToLogin}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Voltar para o login
                </button>
              </div>
            )}
          </form>

          {/* Prompt request access manually */}
          <div className="mt-8 text-center">
            <span className="text-neutral-400 text-xs">Precisa de acesso à plataforma? </span>
            <button
              id="btn-trigger-registration"
              onClick={() => { setShowRegistration(true); setRegistrationSuccess(false); }}
              className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
            >
              Solicitar Acesso
            </button>
          </div>
        </div>
      </motion.div>

      {/* Access Request Form Overlay Modal */}
      <AnimatePresence>
        {showRegistration && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-[2.5rem] overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-neutral-200 dark:border-neutral-800"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-xl text-white">
                    <UserPlus size={20} />
                  </div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Solicitar Acesso</h3>
                </div>
                <button 
                  id="btn-close-registration"
                  onClick={() => { setShowRegistration(false); setRegistrationSuccess(false); }} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all cursor-pointer"
                >
                  <X size={24} className="text-zinc-400" />
                </button>
              </div>

              <div className="p-8">
                {registrationSuccess ? (
                  <div className="text-center py-10 space-y-6">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto shadow-lg">
                      <CheckCircle2 size={48} />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Solicitação Enviada!</h4>
                      <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto text-sm">
                        Recebemos seu pedido. Nossa equipe entrará em contato via e-mail em breve para liberar seu acesso.
                      </p>
                    </div>
                    <button 
                      id="btn-success-reg-ok"
                      onClick={() => { setShowRegistration(false); setRegistrationSuccess(false); }}
                      className="px-8 py-3 bg-zinc-900 dark:bg-zinc-700 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      Entendi
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRequestAccess} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Nome Completo</label>
                        <div className="relative group">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600" size={16} />
                          <input 
                            id="reg-name-input"
                            required
                            value={regForm.name}
                            onChange={e => setRegForm({...regForm, name: e.target.value})}
                            placeholder="Seu nome"
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 dark:text-white font-medium"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">E-mail Profissional</label>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600" size={16} />
                          <input 
                            id="reg-email-input"
                            type="email"
                            required
                            value={regForm.email}
                            onChange={e => setRegForm({...regForm, email: e.target.value})}
                            placeholder="seu@email.com"
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 dark:text-white font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Nome da Oficina</label>
                        <div className="relative group">
                          <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600" size={16} />
                          <input 
                            id="reg-workshop-input"
                            required
                            value={regForm.workshopName}
                            onChange={e => setRegForm({...regForm, workshopName: e.target.value})}
                            placeholder="Nome da empresa"
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 dark:text-white font-medium"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                        <div className="relative group">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600" size={16} />
                          <input 
                            id="reg-phone-input"
                            required
                            value={regForm.phone}
                            onChange={e => setRegForm({...regForm, phone: e.target.value})}
                            placeholder="(00) 00000-0000"
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 dark:text-white font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 font-sans">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Mensagem (Opcional)</label>
                      <textarea 
                        id="reg-message-input"
                        value={regForm.message}
                        onChange={e => setRegForm({...regForm, message: e.target.value})}
                        placeholder="Conte-nos um pouco sobre sua necessidade..."
                        rows={3}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-3 px-4 text-sm outline-none focus:border-blue-600 dark:text-white resize-none font-medium"
                      />
                    </div>

                    <button 
                      id="btn-reg-submit"
                      type="submit"
                      disabled={registrationLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 disabled:opacity-50 mt-4 cursor-pointer"
                    >
                      {registrationLoading ? <Loader2 className="animate-spin" /> : 'Enviar Solicitação'}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer info */}
      <div className="absolute bottom-6 inset-x-4 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-center w-full max-w-3xl gap-1.5 px-6 py-3 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 shadow-xl shadow-black/60 transition-[border-color,box-shadow,background-color] duration-300 ease-out motion-reduce:transition-none hover:bg-black/60 hover:border-blue-400/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.45)] text-center text-white/70 text-[11px] font-semibold tracking-[0.3em] uppercase">
          <span className="text-white">Munago Desenvolvedora de Software</span>
          <span>&copy; 2026 • Gestão Operacional • Versão 1.0.1</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
