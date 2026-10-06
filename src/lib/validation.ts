export const validateEmail = (email: string) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

export const validatePassword = (password: string) => {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(password)) return 'A senha deve conter pelo menos uma letra maiúscula.';
  if (!/[a-z]/.test(password)) return 'A senha deve conter pelo menos uma letra minúscula.';
  if (!/[0-9]/.test(password)) return 'A senha deve conter pelo menos um número.';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return 'A senha deve conter pelo menos um caractere especial.';
  return null;
};
