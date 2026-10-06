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
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, resetPassword } from '../firebase';
import { useApp } from '../context/AppContext';

const Login: React.FC = () => {
  const { 
    login, 
    loginEmail, 
    registerEmail,
    theme, 
    toggleTheme 
  } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
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
      await addDoc(collection(db, 'access_requests'), {
        ...regForm,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      setRegistrationSuccess(true);
      toast.success('Solicitação enviada com sucesso!');
    } catch (error) {
      console.error('Error requesting access:', error);
      toast.error('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      if (authMode === 'login') {
        await loginEmail(email, password);
        toast.success('Login realizado com sucesso!');
      } else {
        await registerEmail(email, password);
        toast.success('Conta criada com sucesso! Verifique a liberação de acesso com o administrador.');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      if (
        error.code === 'auth/user-not-found' || 
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/invalid-credential'
      ) {
        setLoginError('E-mail ou senha incorretos.');
      } else if (error.code === 'auth/email-already-in-use') {
        setLoginError('Este e-mail já está em uso.');
      } else if (error.code === 'auth/weak-password') {
        setLoginError('A senha deve ter pelo menos 6 caracteres.');
      } else if (error.code === 'auth/invalid-email') {
        setLoginError('E-mail inválido.');
      } else if (error.code === 'auth/too-many-requests') {
        setLoginError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setLoginError(error.message || 'Ocorreu um erro. Tente novamente.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setLoginError('Por favor, informe seu e-mail para recuperar a senha.');
      return;
    }
    toast.promise(resetPassword(email), {
      loading: 'Enviando e-mail de recuperação...',
      success: 'E-mail enviado! Verifique sua caixa de entrada.',
      error: 'Erro ao enviar e-mail. Verifique se o endereço está correto.'
    });
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
          onClick={toggleTheme}
          className="p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl hover:scale-110 transition-all text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer"
        >
          {theme === 'light' && <Moon size={24} />}
          {theme === 'dark' && <Sparkles size={24} className="text-blue-400" />}
          {theme === 'vivid' && <Palette size={24} className="text-fuchsia-400" />}
          {theme === 'mono' && <Sun size={24} className="text-zinc-400" />}
          <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">
            {theme === 'light' && 'Claro'}
            {theme === 'dark' && 'Escuro'}
            {theme === 'vivid' && 'Vivid'}
            {theme === 'mono' && 'Mono'}
          </span>
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl flex flex-col lg:flex-row items-stretch justify-center gap-0 z-10 bg-zinc-900/50 backdrop-blur-2xl border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]"
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
              {authMode === 'login' ? 'Acessar Painel' : 'Criar Conta'}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">
              {authMode === 'login' ? 'Entre com suas credenciais para continuar' : 'Preencha os dados para criar seu acesso'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">E-mail</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                <input 
                  id="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="exemplo@email.com"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-4 pl-12 pr-5 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5 font-sans">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                <input 
                  id="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-4 pl-12 pr-5 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none transition-all text-sm font-medium"
                />
              </div>
              {authMode === 'login' && (
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

            {loginError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-xs font-bold"
              >
                <AlertCircle size={16} />
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
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{authMode === 'login' ? 'Entrar no Sistema' : 'Criar minha Conta'}</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>

            <div className="text-center mt-2">
              <button 
                id="btn-toggle-auth-mode"
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {authMode === 'login' ? 'Não tem uma conta? Crie uma agora' : 'Já tem uma conta? Faça login'}
              </button>
            </div>
          </form>

          {/* Social Divider */}
          <div className="relative py-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-100 dark:border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
              <span className="bg-white dark:bg-zinc-900 px-4 text-zinc-400 font-bold">Ou continue com</span>
            </div>
          </div>

          <button 
            id="btn-login-google"
            onClick={async () => {
              setIsLoggingIn(true);
              setLoginError('');
              try {
                await login();
                toast.success('Login realizado com sucesso!');
              } catch (err: any) {
                setLoginError(err.message || 'Erro ao fazer login com Google.');
              } finally {
                setIsLoggingIn(false);
              }
            }}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white px-8 py-3.5 rounded-2xl font-bold transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isLoggingIn ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-sm">Conta Google</span>
              </>
            )}
          </button>

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
      <div className="absolute bottom-6 flex flex-col items-center gap-1 text-white/20 dark:text-white/40 text-[10px] font-bold tracking-[0.4em] uppercase pointer-events-none drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
        <span>Munago Estoque &copy; 2026 • Gestão Operacional • Versão 1.0.1</span>
        <span>Desenvolvido por Murillo Silva</span>
      </div>
    </div>
  );
};

export default Login;
