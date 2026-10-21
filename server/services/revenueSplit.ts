import type { RepasseType } from '../db/schema';

const cents = (v: number) => Math.round(v * 100);

/** Repasse de uma linha de serviço para a empresa: R$ fixo por unidade ou % do preço, em centavos exatos. */
export function serviceRepasse(price: number, quantity: number, type: RepasseType, value: number): number {
  const perUnit = type === 'percent' ? Math.round((cents(price) * value) / 100) : cents(value);
  return (perUnit * quantity) / 100;
}

/**
 * Repasse congelado no pagamento: a empresa recebe a soma dos repasses dos serviços, a oficina o resto.
 * `companySharePercent` é só informativo (participação da empresa no total).
 */
export function freezeSplit(totalAmount: number, repasseAmount: number) {
  const total = cents(totalAmount);
  const company = Math.min(cents(repasseAmount), total);
  return {
    companySharePercent: total > 0 ? Math.round((company / total) * 10_000) / 100 : 0,
    companyAmount: company / 100,
    workshopAmount: (total - company) / 100,
  };
}

export const NO_SPLIT = { companySharePercent: null, companyAmount: null, workshopAmount: null, paidAt: null } as const;
