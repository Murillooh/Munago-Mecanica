/**
 * Repasse do pagamento de uma OS: `companySharePercent` do total vai para a empresa, o resto para a oficina.
 * Arredonda a parte da empresa em centavos e a oficina fica com a diferença, para a soma bater sempre com o total.
 */
export function splitRevenue(totalAmount: number, companySharePercent: number) {
  const total = Math.round(totalAmount * 100);
  const company = Math.round((total * companySharePercent) / 100);
  return {
    companySharePercent,
    companyAmount: company / 100,
    workshopAmount: (total - company) / 100,
  };
}

export const NO_SPLIT = { companySharePercent: null, companyAmount: null, workshopAmount: null, paidAt: null } as const;
