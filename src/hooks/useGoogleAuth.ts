import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet } from '../lib/api';

/**
 * Conecta a conta Google (Drive/Planilhas) num popup. Os tokens ficam no servidor;
 * o popup só avisa quando terminou, e a página recarrega para buscar o novo estado.
 */
export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const { type, error } = (event.data ?? {}) as { type?: string; error?: string };

      if (type === 'OAUTH_AUTH_SUCCESS') {
        window.location.reload();
      } else if (type === 'OAUTH_AUTH_FAILED') {
        toast.error(error || 'Não foi possível conectar a conta Google.');
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  /** 'drive': só backup (escopos não sensíveis, sem aviso do Google). 'sheets': acrescenta leitura de planilhas. */
  const openGoogleAuth = async (purpose: 'drive' | 'sheets' = 'drive') => {
    setIsLoading(true);
    try {
      // Sem isso, um erro do servidor (ex.: OAuth do Google não configurado) abria um popup about:blank.
      const { url } = await apiGet<{ url: string }>(`/google/auth-url?purpose=${purpose}`);
      window.open(url, 'google-auth-popup', 'width=500,height=600');
    } catch (err) {
      console.error('Error opening auth:', err);
      toast.error(err instanceof Error ? err.message : 'Não foi possível iniciar o login com o Google.');
      setIsLoading(false);
    }
  };

  return { openGoogleAuth, isLoading };
}

/** access_token de curta duração para chamar o Drive direto do navegador; null se não conectado. */
export async function fetchGoogleAccessToken(): Promise<string | null> {
  try {
    return (await apiGet<{ accessToken: string }>('/google/access-token')).accessToken;
  } catch (e) {
    if ((e as { code?: string })?.code === 'GOOGLE_NOT_CONNECTED') return null;
    throw e;
  }
}
