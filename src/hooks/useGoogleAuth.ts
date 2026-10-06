import { useEffect, useState, useRef } from 'react';

const EXPECTED_NONCE_TIMESTAMP_DIFF = 5000; // 5 segundos

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const pendingNonceRef = useRef<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validar origin
      if (event.origin !== window.location.origin) {
        console.error('Invalid origin:', event.origin);
        return;
      }

      const { type, tokens, nonce, timestamp, error } = event.data;

      if (type === 'OAUTH_AUTH_SUCCESS') {
        // Validar nonce
        if (nonce !== pendingNonceRef.current) {
          console.error('Invalid nonce');
          return;
        }

        // Validar timestamp
        if (Math.abs(Date.now() - timestamp) > EXPECTED_NONCE_TIMESTAMP_DIFF) {
          console.error('Timestamp mismatch (possible replay attack)');
          return;
        }

        // Tokens válidos - processar
        localStorage.setItem('google_tokens', JSON.stringify(tokens));
        window.location.reload(); // Or pass to success handler
      } else if (type === 'OAUTH_AUTH_FAILED') {
        console.error('Auth failed:', error);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const generateNonce = (): string => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };

  const openGoogleAuth = async () => {
    setIsLoading(true);
    
    // Gerar nonce antes de abrir popup
    pendingNonceRef.current = generateNonce();

    try {
      const response = await fetch(`/api/auth/google/url?nonce=${pendingNonceRef.current}`);
      const { url } = await response.json();
      
      window.open(url, 'google-auth-popup', 'width=500,height=600');
    } catch (err) {
      console.error('Error opening auth:', err);
      setIsLoading(false);
    }
  };

  return { openGoogleAuth, isLoading };
}
