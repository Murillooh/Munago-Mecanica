import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { apiPost } from '../lib/api';
import {
  authErrorMessage,
  confirmPasswordReset,
  confirmRegistration,
  isGoogleLoginEnabled,
  loginWithGoogle,
  register,
  requestPasswordReset,
  resendRegistrationCode,
} from '../lib/auth';

// login: e-mail e senha | signup/confirmSignup: criar conta + código do e-mail | newPassword: primeiro acesso (senha temporária do convite) | resetCode: código recebido por e-mail
type AuthStep = 'login' | 'signup' | 'confirmSignup' | 'newPassword' | 'resetCode';

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
  // Troca de tela: 1 = indo para a solicitação (desliza para a esquerda), -1 = voltando
  const [view, setView] = useState<'login' | 'request'>('login');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    workshopName: '',
    phone: ''
  });

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistrationLoading(true);
    try {
      const { phone, ...required } = regForm;
      await apiPost('/access-requests', {
        ...required,
        ...(phone ? { phone } : {}),
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

  const reduceMotion = useReducedMotion();

  // Só transform/opacity (composição na GPU); com "reduzir movimento" fica só o fade.
  // Conteúdo interno só faz fade: o movimento principal é a troca de lado dos painéis.
  const screenVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 },
  };
  const screenTransition = { duration: reduceMotion ? 0.15 : 0.25, ease: [0.22, 1, 0.36, 1] as const };
  // Troca de lado animada via layout (FLIP: anima transform, sem recalcular layout a cada quadro).
  const sideSwapTransition = { duration: reduceMotion ? 0 : 0.75, ease: [0.65, 0, 0.35, 1] as const };

  // Deslize dos painéis: cada um anda (transform) até a posição do outro.
  // Larguras medidas do DOM; no celular o painel azul fica oculto e nada se move.
  const brandPanelRef = useRef<HTMLDivElement>(null);
  const formPanelRef = useRef<HTMLDivElement>(null);
  const [panelWidths, setPanelWidths] = useState({ brand: 0, form: 0 });
  useLayoutEffect(() => {
    const measure = () => setPanelWidths({
      brand: brandPanelRef.current?.offsetWidth ?? 0,
      form: formPanelRef.current?.offsetWidth ?? 0,
    });
    measure();
    const ro = new ResizeObserver(measure);
    if (brandPanelRef.current) ro.observe(brandPanelRef.current);
    if (formPanelRef.current) ro.observe(formPanelRef.current);
    return () => ro.disconnect();
  }, []);
  const swapped = view === 'request' && panelWidths.brand > 0;
  const brandX = swapped ? panelWidths.form : 0;
  const formX = swapped ? -panelWidths.brand : 0;

  const goTo = (next: 'login' | 'request') => {
    if (next === view) return;
    setDirection(next === 'request' ? 1 : -1);
    if (next === 'request') setRegistrationSuccess(false);
    setLoginError('');
    setView(next);
  };

  // Leva o foco do teclado para a tela que acabou de entrar.
  const focusCurrentView = () => {
    requestAnimationFrame(() => {
      document.getElementById(view === 'request' ? 'reg-name-input' : 'btn-trigger-registration')?.focus();
    });
  };

  const showsCredentials = authStep === 'login' || authStep === 'signup';
  const showsCode = authStep === 'resetCode' || authStep === 'confirmSignup';
  const showsNewPassword = authStep === 'newPassword' || authStep === 'resetCode';

  const switchStep = (step: AuthStep) => {
    setAuthStep(step);
    setResetCode('');
    setLoginError('');
  };

  const handleResendCode = async () => {
    setLoginError('');
    try {
      await resendRegistrationCode(email);
      toast.success(`Enviamos um novo código para ${email}.`);
    } catch (error) {
      setLoginError(authErrorMessage(error));
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

    if (showsNewPassword && newPassword !== confirmNewPassword) {
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
      } else if (authStep === 'signup') {
        await register(email, password);
        setAuthStep('confirmSignup');
        toast.success(`Enviamos um código de verificação para ${email}.`);
      } else if (authStep === 'confirmSignup') {
        await confirmRegistration(email, resetCode);
        // Conta confirmada: entra direto. O admin ainda precisa aprovar o acesso.
        await loginEmail(email, password);
        toast.success('Conta criada! Aguarde a liberação do administrador.');
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

  // Sai do app para a tela do Google; a volta é tratada no AppContext.
  const handleGoogleLogin = async () => {
    setLoginError('');
    if (!isGoogleLoginEnabled) {
      setLoginError('O login com Google ainda não foi configurado.');
      return;
    }
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Google login error:', error);
      setLoginError('Não foi possível abrir o login do Google. Tente novamente.');
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
    signup: ['Criar Conta', 'Preencha os dados para criar seu acesso'],
    confirmSignup: ['Confirme seu e-mail', `Digite o código enviado para ${email}`],
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
        className={`w-full max-w-6xl lg:min-h-[680px] flex flex-col lg:flex-row items-stretch relative justify-center gap-0 z-10 bg-zinc-900/50 backdrop-blur-2xl border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]`}
      >
        {/* Left Side: Branding & Info */}
        <motion.div
          ref={brandPanelRef}
          initial={false}
          animate={{ x: brandX }}
          transition={sideSwapTransition}
          className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 p-16 flex-col justify-between relative overflow-hidden z-10"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 font-black text-xl shadow-xl">ME</div>
              <span className="font-black text-3xl tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">Munago <span className="text-blue-200">Estoque</span></span>
            </div>
            
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -12 }}
                transition={screenTransition}
              >
                {view === 'login' ? (
                  <>
                    <h2 className="text-5xl font-black text-white leading-[1.1] mb-6 drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                      Gestão Inteligente <br />
                      <span className="text-blue-200">Para sua Oficina.</span>
                    </h2>
                    <p className="text-blue-50 text-lg font-medium max-w-md leading-relaxed opacity-80">
                      Controle de estoque, ordens de serviço e inteligência artificial em uma única plataforma robusta e intuitiva.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-5xl font-black text-white leading-[1.1] mb-6 drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                      Faça parte <br />
                      <span className="text-blue-200">da plataforma.</span>
                    </h2>
                    <p className="text-blue-50 text-lg font-medium max-w-md leading-relaxed opacity-80">
                      Envie seus dados e um administrador analisa o pedido. Quando aprovado, o acesso chega no seu e-mail.
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
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
        </motion.div>

        {/* Right Side: troca animada entre login e solicitação de acesso */}
        <motion.div
          ref={formPanelRef}
          initial={false}
          animate={{ x: formX }}
          transition={sideSwapTransition}
          className="w-full lg:w-[450px] p-8 md:p-12 lg:p-14 flex flex-col justify-center bg-white dark:bg-zinc-900 overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false} custom={direction} onExitComplete={focusCurrentView}>
            {view === 'login' ? (
              <motion.div
                key="login"
                custom={direction}
                variants={screenVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={screenTransition}
              >
                <div className="mb-10">
                  <h1 className="text-3xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">
                    {titles[authStep][0]}
                  </h1>
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">
                    {titles[authStep][1]}
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4" aria-busy={isLoggingIn}>
                  {showsCredentials && (
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
                            autoComplete={authStep === 'signup' ? 'new-password' : 'current-password'}
                            minLength={authStep === 'signup' ? 8 : undefined}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            aria-invalid={!!loginError}
                            aria-describedby={loginError ? 'login-error' : undefined}
                            className={inputClass}
                          />
                        </div>
                        {authStep === 'signup' ? (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1">
                            Mínimo de 8 caracteres, com letras minúsculas e números.
                          </p>
                        ) : (
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
                        )}
                      </div>
                    </>
                  )}

                  {showsCode && (
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

                  {showsNewPassword && (
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
                        <span>{({ login: 'Entrar no Sistema', signup: 'Criar minha Conta', confirmSignup: 'Confirmar e Entrar', newPassword: 'Salvar nova senha', resetCode: 'Salvar nova senha' } as const)[authStep]}</span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </>
                    )}
                  </button>

                  <div className="text-center mt-2 flex flex-col items-center gap-2">
                    {authStep === 'confirmSignup' && (
                      <button
                        type="button"
                        onClick={handleResendCode}
                        className="text-xs font-bold text-zinc-400 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        Não recebeu? Reenviar código
                      </button>
                    )}
                    <button
                      id="btn-toggle-auth-mode"
                      type="button"
                      onClick={() => (authStep === 'login' ? switchStep('signup') : backToLogin())}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {authStep === 'login'
                        ? 'Não tem uma conta? Crie uma agora'
                        : authStep === 'signup'
                          ? 'Já tem uma conta? Faça login'
                          : 'Voltar para o login'}
                    </button>
                  </div>
                </form>

                {showsCredentials && (
                  <>
                    {/* Social Divider */}
                    <div className="relative py-6">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-zinc-100 dark:border-zinc-800"></div>
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
                        <span className="bg-white dark:bg-zinc-900 px-4 text-zinc-400 font-bold">Ou continue com</span>
                      </div>
                    </div>

                    <button
                      id="btn-login-google"
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn}
                      className="w-full flex items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white px-8 py-3.5 rounded-2xl font-bold transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm disabled:opacity-50 cursor-pointer active:scale-95"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span className="text-sm">Conta Google</span>
                    </button>
                  </>
                )}

                {/* Prompt request access manually */}
                <div className="mt-8 text-center">
                  <span className="text-neutral-400 text-xs">Precisa de acesso à plataforma? </span>
                  <button
                    id="btn-trigger-registration"
                    type="button"
                    onClick={() => goTo('request')}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    Solicitar Acesso
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="request"
                custom={direction}
                variants={screenVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={screenTransition}
              >
                <div className="mb-8 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => goTo('login')}
                    aria-label="Voltar para o login"
                    className="mt-1 p-2 -ml-2 rounded-xl text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={20} aria-hidden="true" />
                  </button>
                  <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">Solicitar Acesso</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">
                      {registrationSuccess ? 'Pedido recebido' : 'Preencha os dados e um administrador analisa seu pedido'}
                    </p>
                  </div>
                </div>

                {registrationSuccess ? (
                  <div className="text-center py-6 space-y-6" role="status">
                    <motion.div
                      initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                      className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto shadow-lg"
                    >
                      <CheckCircle2 size={48} aria-hidden="true" />
                    </motion.div>
                    <div>
                      <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Solicitação Enviada!</h2>
                      <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto text-sm">
                        Recebemos seu pedido. Quando for aprovado, você recebe por e-mail uma senha temporária para entrar.
                      </p>
                    </div>
                    <button
                      id="btn-success-reg-ok"
                      type="button"
                      onClick={() => goTo('login')}
                      className="px-8 py-3 bg-zinc-900 dark:bg-zinc-700 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      Voltar para o login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRequestAccess} className="space-y-3" aria-busy={registrationLoading}>
                    {([
                      { id: 'reg-name-input', key: 'name', label: 'Nome Completo', icon: User, placeholder: 'Seu nome', type: 'text', autoComplete: 'name', required: true },
                      { id: 'reg-email-input', key: 'email', label: 'E-mail Profissional', icon: Mail, placeholder: 'seu@email.com', type: 'email', autoComplete: 'email', required: true },
                      { id: 'reg-workshop-input', key: 'workshopName', label: 'Nome da Oficina', icon: Building, placeholder: 'Nome da empresa', type: 'text', autoComplete: 'organization', required: true },
                      { id: 'reg-phone-input', key: 'phone', label: 'Telefone / WhatsApp', icon: Phone, placeholder: '(00) 00000-0000', type: 'tel', autoComplete: 'tel', required: true },
                    ] as const).map(({ id, key, label, icon: Icon, ...input }) => (
                      <div key={id} className="space-y-1">
                        <label htmlFor={id} className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{label}</label>
                        <div className="relative group">
                          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600" size={16} aria-hidden="true" />
                          <input
                            id={id}
                            {...input}
                            value={regForm[key]}
                            onChange={e => setRegForm({ ...regForm, [key]: e.target.value })}
                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 dark:text-white font-medium transition-all"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      id="btn-reg-submit"
                      type="submit"
                      disabled={registrationLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 disabled:opacity-50 mt-2 cursor-pointer active:scale-95"
                    >
                      {registrationLoading ? (
                        <>
                          <Loader2 className="animate-spin" aria-hidden="true" />
                          <span className="sr-only">Enviando...</span>
                        </>
                      ) : 'Enviar Solicitação'}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

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
