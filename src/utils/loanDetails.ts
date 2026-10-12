import { ExtractionMeta, LoanDetails } from '../types';

export const emptyLoanDetails = (): LoanDetails => ({ originalLoanAmount: null, originalLoanAmountConfirmed: false });
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const normalizeStartMonth = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  const match = value.match(/^([A-Za-z]{3}) (\d{4})$/);
  const month = match ? months.indexOf(match[1]) : -1;
  return match && month >= 0 ? `${match[2]}-${String(month + 1).padStart(2, '0')}` : undefined;
};
export const loanPeriodLabel = (details: LoanDetails): string => details.startMonth
  ? `${months[Number(details.startMonth.slice(5)) - 1]} ${details.startMonth.slice(0, 4)}`
  : details.legacy?.contractedPeriod ?? details.legacy?.contractedYear ?? '';

/** Locked is explicit user confirmation in the existing editor; ambiguous values stay candidates. */
export const migrateLoanDetails = (existing: LoanDetails | null, meta: ExtractionMeta | null): LoanDetails => {
  if (existing) return existing;
  if (!meta) return emptyLoanDetails();
  const { originalPrincipal, originalPrincipalLocked, contractedPeriod, contractedYear } = meta;
  return {
    originalLoanAmount: originalPrincipal ?? null,
    originalLoanAmountConfirmed: originalPrincipalLocked === true,
    startMonth: normalizeStartMonth(contractedPeriod ?? contractedYear),
    legacy: { originalPrincipal, originalPrincipalLocked, contractedPeriod, contractedYear }
  };
};
