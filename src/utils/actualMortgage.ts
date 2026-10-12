import { ActualMortgageState, ExtractionMeta, LoanDetails, ScheduleRow } from '../types';
import { fromCents, toCents } from './number';
import { findDuplicateInstallments, principalRows } from './rows';
import { installmentDate } from './scheduleComparison';

export const principalRepaid = (loan: LoanDetails, outstanding: number | null): ActualMortgageState['principalRepaid'] => {
  const unavailable = (reason: string) => ({ amount: null, percentage: null, reason });
  const original = loan.originalLoanAmount;
  if (original == null) return unavailable('Original loan amount missing');
  if (!loan.originalLoanAmountConfirmed) return unavailable('Original loan amount unconfirmed');
  if (!Number.isFinite(original) || original <= 0 || toCents(original) <= 0) return unavailable('Invalid original loan amount');
  if (outstanding == null || !Number.isFinite(outstanding) || outstanding < 0) return unavailable('Outstanding principal unavailable or invalid');
  if (outstanding > original) return unavailable('Outstanding principal exceeds original loan amount');
  const repaid = toCents(original) - toCents(outstanding);
  return { amount: fromCents(repaid), percentage: repaid / toCents(original) * 100, reason: null };
};

/** Preserves full-PDF principal interpretation; first unpaid selects upcoming installments only. */
export const selectActualMortgage = (rows: ScheduleRow[], meta: ExtractionMeta | null,
  firstUnpaidRowId: string | null, loan: LoanDetails): ActualMortgageState => {
  const payments = principalRows(rows);
  const valid = payments.length > 0 && !findDuplicateInstallments(payments).length && rows.every(row =>
    Number.isFinite(row.creditAmount) && row.creditAmount >= 0 && Number.isInteger(row.installmentNumber) && row.installmentNumber > 0);
  const outstanding = valid ? fromCents(payments.reduce((sum, row) => sum + toCents(row.creditAmount), 0)) : null;
  const index = valid ? payments.findIndex(row => row.id === firstUnpaidRowId) : -1;
  const next = index >= 0 ? payments[index] : null;
  const remaining = index >= 0 ? payments.slice(index) : null;
  const interestValid = (row: ScheduleRow) => row.interestAmount != null && Number.isFinite(row.interestAmount) && row.interestAmount >= 0;
  const interest = remaining?.every(interestValid) ? fromCents(remaining.reduce((sum, row) => sum + toCents(row.interestAmount!), 0)) : null;
  const nextInterest = next && interestValid(next) ? next.interestAmount! : null;
  const remainingPrincipal = remaining ? fromCents(remaining.reduce((sum, row) => sum + toCents(row.creditAmount), 0)) : null;
  return {
    outstandingPrincipal: outstanding, firstUnpaidInstallment: next ? { ...next, rawRowData: next.rawRowData ? { ...next.rawRowData } : undefined } : null,
    nextInstallmentDate: next ? installmentDate(next) : null,
    nextInstallmentAmount: next && nextInterest != null ? fromCents(toCents(next.creditAmount) + toCents(nextInterest)) : null,
    nextPrincipal: next?.creditAmount ?? null, nextInterest,
    installmentsRemaining: remaining?.length ?? null,
    lastScheduledPaymentDate: valid ? installmentDate(payments[payments.length - 1]) : null,
    remainingInterest: interest,
    totalRemainingScheduledPayments: remainingPrincipal != null && interest != null ? fromCents(toCents(remainingPrincipal) + toCents(interest)) : null,
    principalRepaid: principalRepaid(loan, outstanding), sourceFileName: meta?.sourceFileName ?? null, extractedAt: meta?.extractedAt ?? null
  };
};
