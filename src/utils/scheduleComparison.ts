import { ExtractionMeta, PdfParseResult, PreviousScheduleSnapshot, ScheduleComparison, ScheduleRow } from '../types';
import { fromCents, toCents } from './number';
import { actualPrincipalRemaining, findDuplicateInstallments, principalRows } from './rows';
import { parseScheduleDateFromText } from './scheduleDate';

export const isAcceptablePdfSchedule = (result: PdfParseResult): boolean =>
  principalRows(result.rows).length > 0 &&
  !result.warnings.some((warning) => warning.severity === 'error') &&
  result.rows.every((row) => Number.isFinite(row.creditAmount) && row.creditAmount >= 0 &&
    Number.isInteger(row.installmentNumber) && row.installmentNumber > 0) &&
  findDuplicateInstallments(principalRows(result.rows)).length === 0;

export const totalRemainingInterest = (rows: ScheduleRow[], firstUnpaidRowId: string | null): number | null => {
  const payments = principalRows(rows);
  const start = payments.findIndex((row) => row.id === firstUnpaidRowId);
  if (start < 0 || findDuplicateInstallments(payments).length) return null;
  const remaining = payments.slice(start);
  // Require every remaining installment's explicit normalized interest. No inference,
  // lastInterestAmount fallback, manually entered interest, or scenario savings.
  if (remaining.some((row) => row.interestAmount == null ||
    !Number.isFinite(row.interestAmount) || row.interestAmount < 0)) return null;
  return fromCents(remaining.reduce((sum, row) => sum + toCents(row.interestAmount!), 0));
};

export const finalScheduledPaymentDate = (rows: ScheduleRow[]): string | null => {
  for (const row of principalRows(rows).reverse()) {
    const values = row.paymentDate ? [row.paymentDate] : Object.values(row.rawRowData ?? {});
    for (const value of values) {
      const date = parseScheduleDateFromText(value);
      if (date) return date;
    }
  }
  return null;
};

export const createRealScheduleSnapshot = (
  rows: ScheduleRow[], meta: ExtractionMeta | null, firstUnpaidRowId: string | null
): PreviousScheduleSnapshot | null => {
  if (!meta || !principalRows(rows).length) return null;
  return {
    sourceFileName: meta.sourceFileName,
    extractedAt: meta.extractedAt,
    firstUnpaidRowId,
    principalRemaining: actualPrincipalRemaining(rows),
    remainingInterest: totalRemainingInterest(rows, firstUnpaidRowId),
    finalPaymentDate: finalScheduledPaymentDate(rows)
  };
};

export const compareRealSchedules = (
  previous: PreviousScheduleSnapshot | null, current: PreviousScheduleSnapshot | null
): ScheduleComparison | null => {
  if (!previous || !current) return null;
  const before = previous.finalPaymentDate;
  const after = current.finalPaymentDate;
  return {
    previous, current,
    principalDelta: fromCents(toCents(current.principalRemaining) - toCents(previous.principalRemaining)),
    interestDelta: previous.remainingInterest == null || current.remainingInterest == null ? null :
      fromCents(toCents(current.remainingInterest) - toCents(previous.remainingInterest)),
    termDifferenceMonths: before && after ?
      (Number(after.slice(0, 4)) - Number(before.slice(0, 4))) * 12 +
      Number(after.slice(5, 7)) - Number(before.slice(5, 7)) : null
  };
};
