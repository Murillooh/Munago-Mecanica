import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function SetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token não fornecido. Link inválido.');
    }
  }, [token]);

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) return 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(pass)) return 'Deve conter letra maiúscula';
    if (!/[a-z]/.test(pass)) return 'Deve conter letra minúscula';
    if (!/\d/.test(pass)) return 'Deve conter número';
    if (!/[@$!%*#?&]/.test(pass)) return 'Deve conter caractere especial (@$!%*#?&)';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações
    if (!token) {
      setError('Token inválido');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao configurar senha');
      }

      setSuccess(true);
      toast.success('Senha configurada com sucesso!');
      
      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/', { replace: true }); // Assuming / is dashboard/login redirect
      }, 2000);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="text-center bg-white dark:bg-zinc-900 p-10 rounded-[3rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 max-w-md w-full">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-4">Sucesso!</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">Sua senha foi configurada. Redirecionando para login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="bg-white dark:bg-zinc-900 p-12 rounded-[3rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 max-w-md w-full">
        <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white mb-8 mx-auto shadow-xl shadow-blue-600/30">
          <Lock size={32} />
        </div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-2 text-center">Configure sua Senha</h1>
        <p className="text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-[0.3em] mb-8 text-center">
          Crie uma senha forte para sua conta
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-2xl mb-6 flex gap-3 items-center text-[11px] font-black uppercase tracking-widest leading-relaxed">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
              Nova Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full pl-6 pr-12 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl font-bold dark:text-white outline-none focus:ring-4 focus:ring-blue-600/10 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
              Confirmar Senha
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl font-bold dark:text-white outline-none focus:ring-4 focus:ring-blue-600/10 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? 'Configurando...' : 'Configurar Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
