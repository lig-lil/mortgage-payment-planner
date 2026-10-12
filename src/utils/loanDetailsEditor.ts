import { LoanDetails } from '../types';
import { parseFlexibleNumber } from './number';
import { normalizeStartMonth } from './loanDetails';

export const saveLoanDetails = (current: LoanDetails, amountText: string, startMonth: string): LoanDetails => {
  const amount = amountText.trim() ? parseFlexibleNumber(amountText) : null;
  const validMoney = /^(?:\d+(?:[.,]\d{1,2})?|\d{1,3}(?:[ ,]\d{3})+(?:\.\d{1,2})?|\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?)$/.test(amountText.trim());
  if (amountText.trim() && (amount == null || !Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100)) || amount <= 0 || !validMoney)) {
    throw new Error('Enter a valid original loan amount greater than zero.');
  }
  if (startMonth && (!normalizeStartMonth(startMonth) || Number(startMonth.slice(0, 4)) < 1000)) {
    throw new Error('Enter a valid start month and year (YYYY-MM).');
  }
  return { ...current, originalLoanAmount: amount, originalLoanAmountConfirmed: amount != null, startMonth: startMonth || undefined };
};
