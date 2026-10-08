import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { 
  Lock, 
  Mail, 
  Sparkles, 
  Palette, 
  X, 
  User,
  ChevronRight, 
  Loader2, 
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { AUTH_BG, AUTH_PANEL_GRID } from '../components/auth/authStyles';
import { AuthFeatures } from '../components/auth/AuthFeatures';
import { useApp } from '../context/AppContext';
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

// login: e-mail e senha | newPassword: primeiro acesso (senha temporária do convite) | resetCode: código recebido por e-mail
type AuthStep = 'login' | 'newPassword' | 'resetCode';
// Cadastro (tela "Criar Conta"): form = dados + senha | code = código enviado ao e-mail
type SignupStep = 'form' | 'code';

const inputClass = "w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-4 pl-12 pr-5 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all text-sm font-medium";
const passwordInputClass = inputClass.replace('pr-5', 'pr-12');

const PasswordToggle: React.FC<{ visible: boolean; onToggle: () => void }> = ({ visible, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
    aria-pressed={visible}
    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 focus-visible:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 transition-colors cursor-pointer"
  >
    {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
  </button>
);

const regInputClass = "w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 dark:text-white font-medium transition-all";
const regPasswordInputClass = regInputClass.replace('pr-4', 'pr-12');
const regLabelClass = "text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1";
const regIconClass = "absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600";

const SocialDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="relative py-6">
    <div className="absolute inset-0 flex items-center" aria-hidden="true">
      <div className="w-full border-t border-zinc-100 dark:border-zinc-800"></div>
    </div>
    <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
      <span className="bg-white dark:bg-zinc-900 px-4 text-zinc-400 font-bold">{label}</span>
    </div>
  </div>
);

const GoogleButton: React.FC<{ id: string; label: string; onClick: () => void; disabled: boolean }> = ({ id, label, onClick, disabled }) => (
  <button
    id={id}
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full flex items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white px-8 py-3.5 rounded-2xl font-bold transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm disabled:opacity-50 cursor-pointer active:scale-95"
  >
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
    <span className="text-sm">{label}</span>
  </button>
);

// Fundo e painel compartilhados com a tela de espera de aprovação.
const LOGIN_BG = AUTH_BG;
const PANEL_GRID = AUTH_PANEL_GRID;

const LegalNotice = () => (
  <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
    Ao continuar, você concorda com os{' '}
    <a href="/termos.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400">Termos de Serviço</a>
    {' '}e a{' '}
    <a href="/privacidade.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400">Política de Privacidade</a>.
  </p>
);

const Login: React.FC = () => {
  const {
    loginEmail,
    completeNewPassword
  } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>('login');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Cadastro de conta
  // Troca de tela: 1 = indo para o cadastro (desliza para a esquerda), -1 = voltando
  const [view, setView] = useState<'login' | 'request'>('login');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [signupStep, setSignupStep] = useState<SignupStep>('form');
  const [signupError, setSignupError] = useState('');
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupCode, setSignupCode] = useState('');
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    if (regForm.password !== regForm.confirmPassword) {
      setSignupError('As senhas não coincidem.');
      return;
    }
    setRegistrationLoading(true);
    try {
      await register(regForm.name, regForm.email, regForm.password);
      setSignupCode('');
      setSignupStep('code');
      toast.success(`Enviamos um código de verificação para ${regForm.email}.`);
    } catch (error) {
      console.error('Signup error:', error);
      setSignupError(authErrorMessage(error));
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleConfirmSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    setRegistrationLoading(true);
    try {
      await confirmRegistration(regForm.email, signupCode);
      // Conta confirmada: entra direto. O admin ainda precisa aprovar o acesso.
      await loginEmail(regForm.email, regForm.password);
      toast.success('Conta criada! Aguarde a liberação do administrador.');
    } catch (error) {
      console.error('Confirm signup error:', error);
      setSignupError(authErrorMessage(error));
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleResendCode = async () => {
    setSignupError('');
    try {
      await resendRegistrationCode(regForm.email);
      toast.success(`Enviamos um novo código para ${regForm.email}.`);
    } catch (error) {
      setSignupError(authErrorMessage(error));
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
    setLoginError('');
    setSignupError('');
    setView(next);
  };

  // Leva o foco do teclado para a tela que acabou de entrar.
  const focusCurrentView = () => {
    requestAnimationFrame(() => {
      const target = view === 'request'
        ? (signupStep === 'code' ? 'signup-code-input' : 'reg-name-input')
        : 'btn-toggle-auth-mode';
      document.getElementById(target)?.focus();
    });
  };

  const showsCredentials = authStep === 'login';
  const showsCode = authStep === 'resetCode';
  const showsNewPassword = authStep === 'newPassword' || authStep === 'resetCode';

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
  // No primeiro acesso o servidor cria a conta com nome e e-mail do Google (pendente de aprovação).
  const handleGoogleLogin = async (setError: (msg: string) => void) => {
    setError('');
    if (!isGoogleLoginEnabled) {
      setError('O login com Google ainda não foi configurado.');
      return;
    }
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Google login error:', error);
      setError('Não foi possível abrir o login do Google. Tente novamente.');
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
    <div id="login-root-container" className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 relative overflow-hidden font-sans">
      {/* Fundo: pontilhado sutil que some nas bordas, luz azul parada atrás do card,
          granulação e vinheta. Só CSS: sem imagem externa e sem animação. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={LOGIN_BG.glow} />
        <div className="absolute inset-0" style={LOGIN_BG.grid} />
                <div className="absolute inset-0" style={LOGIN_BG.vignette} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-6xl lg:min-h-[680px] flex flex-col lg:flex-row items-stretch relative justify-center gap-0 z-10 bg-zinc-900/50 backdrop-blur-2xl border border-white/10 rounded-[2rem] lg:rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]`}
      >
        {/* Left Side: Branding & Info */}
        <motion.div
          ref={brandPanelRef}
          initial={false}
          animate={{ x: brandX }}
          transition={sideSwapTransition}
          className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 p-16 flex-col justify-between relative overflow-hidden z-10"
        >
          <div aria-hidden="true" className="absolute inset-0" style={PANEL_GRID} />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <img src="/brand/munago-mecanica-icon.svg" alt="" width={48} height={48} className="h-12 w-12 rounded-xl shadow-xl ring-1 ring-white/20" />
              <span className="font-black text-3xl tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">Munago <span className="text-amber-300">Mecânica</span></span>
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
                      Crie sua conta em poucos passos. Assim que um administrador liberar, você já entra no sistema.
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <AuthFeatures />

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
          className="w-full lg:w-[450px] p-6 sm:p-8 md:p-12 lg:p-14 flex flex-col justify-center bg-white dark:bg-zinc-900 overflow-hidden"
        >
          {/* Celular/tablet: o painel azul some, então a marca vem para o topo do formulário. */}
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <img src="/brand/munago-mecanica-icon.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
            <span className="font-black text-xl tracking-tight text-zinc-900 dark:text-white">Munago <span className="text-amber-500 dark:text-amber-300">Mecânica</span></span>
          </div>
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
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            aria-invalid={!!loginError}
                            aria-describedby={loginError ? 'login-error' : undefined}
                            className={passwordInputClass}
                          />
                          <PasswordToggle visible={showPassword} onToggle={() => setShowPassword(v => !v)} />
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
                            type={showNewPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="••••••••"
                            aria-describedby="new-password-hint"
                            className={passwordInputClass}
                          />
                          <PasswordToggle visible={showNewPassword} onToggle={() => setShowNewPassword(v => !v)} />
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
                            type={showNewPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="••••••••"
                            className={passwordInputClass}
                          />
                          <PasswordToggle visible={showNewPassword} onToggle={() => setShowNewPassword(v => !v)} />
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

                  <div className="text-center mt-2 flex flex-col items-center gap-2">
                    <button
                      id="btn-toggle-auth-mode"
                      type="button"
                      onClick={() => (authStep === 'login' ? goTo('request') : backToLogin())}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {authStep === 'login' ? 'Não tem uma conta? Crie uma agora' : 'Voltar para o login'}
                    </button>
                  </div>
                </form>

                {showsCredentials && (
                  <>
                    <SocialDivider label="Ou continue com" />
                    <GoogleButton
                      id="btn-login-google"
                      label="Conta Google"
                      onClick={() => handleGoogleLogin(setLoginError)}
                      disabled={isLoggingIn}
                    />
                    <LegalNotice />
                  </>
                )}
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
                    onClick={() => (signupStep === 'code' ? (setSignupStep('form'), setSignupError('')) : goTo('login'))}
                    aria-label={signupStep === 'code' ? 'Voltar e corrigir os dados' : 'Voltar para o login'}
                    className="mt-1 p-2 -ml-2 rounded-xl text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={20} aria-hidden="true" />
                  </button>
                  <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">
                      {signupStep === 'code' ? 'Confirme seu e-mail' : 'Criar Conta'}
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">
                      {signupStep === 'code'
                        ? `Digite o código enviado para ${regForm.email}`
                        : 'Preencha seus dados ou cadastre-se com o Google'}
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={signupStep === 'code' ? handleConfirmSignup : handleSignup}
                  className="space-y-3"
                  aria-busy={registrationLoading}
                >
                  {signupStep === 'form' ? (
                    <>
                      {([
                        { id: 'reg-name-input', key: 'name', label: 'Nome Completo', icon: User, placeholder: 'Seu nome', type: 'text', autoComplete: 'name' },
                        { id: 'reg-email-input', key: 'email', label: 'E-mail', icon: Mail, placeholder: 'seu@email.com', type: 'email', autoComplete: 'email' },
                      ] as const).map(({ id, key, label, icon: Icon, ...input }) => (
                        <div key={id} className="space-y-1">
                          <label htmlFor={id} className={regLabelClass}>{label}</label>
                          <div className="relative group">
                            <Icon className={regIconClass} size={16} aria-hidden="true" />
                            <input
                              id={id}
                              {...input}
                              required
                              value={regForm[key]}
                              onChange={e => setRegForm({ ...regForm, [key]: e.target.value })}
                              className={regInputClass}
                            />
                          </div>
                        </div>
                      ))}

                      <div className="space-y-1">
                        <label htmlFor="reg-password-input" className={regLabelClass}>Senha</label>
                        <div className="relative group">
                          <Lock className={regIconClass} size={16} aria-hidden="true" />
                          <input
                            id="reg-password-input"
                            type={showSignupPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            minLength={8}
                            placeholder="••••••••"
                            value={regForm.password}
                            onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                            aria-describedby="reg-password-hint"
                            className={regPasswordInputClass}
                          />
                          <PasswordToggle visible={showSignupPassword} onToggle={() => setShowSignupPassword(v => !v)} />
                        </div>
                        <p id="reg-password-hint" className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1">
                          Mínimo de 8 caracteres, com letras minúsculas e números.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="reg-confirm-password-input" className={regLabelClass}>Confirmar Senha</label>
                        <div className="relative group">
                          <Lock className={regIconClass} size={16} aria-hidden="true" />
                          <input
                            id="reg-confirm-password-input"
                            type={showSignupPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            minLength={8}
                            placeholder="••••••••"
                            value={regForm.confirmPassword}
                            onChange={e => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                            className={regPasswordInputClass}
                          />
                          <PasswordToggle visible={showSignupPassword} onToggle={() => setShowSignupPassword(v => !v)} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <label htmlFor="signup-code-input" className={regLabelClass}>Código de verificação</label>
                      <div className="relative group">
                        <ShieldCheck className={regIconClass} size={16} aria-hidden="true" />
                        <input
                          id="signup-code-input"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          required
                          placeholder="123456"
                          value={signupCode}
                          onChange={e => setSignupCode(e.target.value)}
                          aria-invalid={!!signupError}
                          aria-describedby={signupError ? 'signup-error' : undefined}
                          className={regInputClass}
                        />
                      </div>
                    </div>
                  )}

                  {signupError && (
                    <div
                      id="signup-error"
                      role="alert"
                      className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-xs font-bold"
                    >
                      <AlertCircle size={16} aria-hidden="true" />
                      <p>{signupError}</p>
                    </div>
                  )}

                  <button
                    id="btn-reg-submit"
                    type="submit"
                    disabled={registrationLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 disabled:opacity-50 mt-2 cursor-pointer active:scale-95"
                  >
                    {registrationLoading ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden="true" />
                        <span className="sr-only">Aguarde...</span>
                      </>
                    ) : signupStep === 'code' ? 'Confirmar e Entrar' : 'Criar minha Conta'}
                  </button>

                  {signupStep === 'code' && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handleResendCode}
                        className="text-xs font-bold text-zinc-400 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        Não recebeu? Reenviar código
                      </button>
                    </div>
                  )}
                </form>

                {signupStep === 'form' && (
                  <>
                    <SocialDivider label="Ou cadastre-se com" />
                    <GoogleButton
                      id="btn-signup-google"
                      label="Conta Google"
                      onClick={() => handleGoogleLogin(setSignupError)}
                      disabled={isLoggingIn || registrationLoading}
                    />
                    <LegalNotice />
                    <p className="mt-6 text-center text-xs text-zinc-400">
                      Já tem uma conta?{' '}
                      <button
                        type="button"
                        onClick={() => goTo('login')}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Faça login
                      </button>
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Footer info */}
      {/* No fluxo (abaixo do card): em celular ou tela baixa não sobrepõe o formulário. */}
      <div className="relative z-10 flex w-full justify-center">
        <div className="flex flex-col items-center w-full max-w-3xl gap-1.5 px-4 sm:px-6 py-3 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 shadow-xl shadow-black/60 transition-[border-color,box-shadow,background-color] duration-300 ease-out motion-reduce:transition-none hover:bg-black/60 hover:border-blue-400/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.45)] text-center text-white/70 text-[10px] sm:text-[11px] font-semibold tracking-[0.15em] sm:tracking-[0.3em] uppercase">
          <span className="text-white">Munago Desenvolvedora de Software</span>
          <span>&copy; 2026 • Gestão Operacional • Versão 1.0.1</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
