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

const installmentDate = (row: ScheduleRow): string | null => {
  const values = row.paymentDate ? [row.paymentDate] : Object.values(row.rawRowData ?? {});
  for (const value of values) {
    const date = parseScheduleDateFromText(value);
    if (date) return date;
  }
  return null;
};

const validPayments = (rows: ScheduleRow[]): ScheduleRow[] | null => {
  const payments = principalRows(rows);
  if (!payments.length || findDuplicateInstallments(payments).length || payments.some(row =>
    !Number.isFinite(row.creditAmount) || !Number.isInteger(row.installmentNumber) || row.installmentNumber <= 0)) return null;
  const dates = payments.map(installmentDate).filter((date): date is string => date != null);
  if (dates.some((date, index) => index > 0 && date <= dates[index - 1])) return null;
  return payments;
};

export const estimateInterestSaved = (
  previous: PreviousScheduleSnapshot | null, current: PreviousScheduleSnapshot | null
): ScheduleComparison['estimatedInterestSaved'] => {
  if (!previous?.installments || !current?.installments) return null;
  const before = validPayments(previous.installments);
  const after = validPayments(current.installments);
  if (!before || !after) return null;
  const currentStart = after.findIndex(row => row.id === current.firstUnpaidRowId);
  if (currentStart < 0) return null;
  const start = after[currentStart];
  const startDate = installmentDate(start);
  let previousStart = startDate ? before.findIndex(row => installmentDate(row) === startDate) : -1;
  if (previousStart < 0) {
    const numberMatch = before.findIndex(row => row.installmentNumber === start.installmentNumber);
    if (numberMatch < 0 || (startDate && installmentDate(before[numberMatch]))) return null;
    // Numbers may restart in a new PDF: dated overlap must establish continuity.
    let confirmed = false;
    for (const row of after) {
      const date = installmentDate(row);
      const sameDate = date ? before.find(other => installmentDate(other) === date) : undefined;
      const sameNumber = before.find(other => other.installmentNumber === row.installmentNumber);
      if (sameDate && sameDate.installmentNumber !== row.installmentNumber) return null;
      if (date && sameNumber && installmentDate(sameNumber) && installmentDate(sameNumber) !== date) return null;
      if (sameDate) confirmed = true;
    }
    if (!confirmed) return null;
    previousStart = numberMatch;
  }
  const sumInterest = (rows: ScheduleRow[]): number | null => {
    if (rows.some(row => row.interestAmount == null || !Number.isFinite(row.interestAmount) || row.interestAmount < 0)) return null;
    return rows.reduce((sum, row) => sum + toCents(row.interestAmount!), 0);
  };
  const previousInterest = sumInterest(before.slice(previousStart));
  const currentInterest = sumInterest(after.slice(currentStart));
  if (previousInterest == null || currentInterest == null || previousInterest < currentInterest) return null;
  return { amount: fromCents(previousInterest - currentInterest), startDate, installmentNumber: start.installmentNumber };
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
    installmentsRemaining: principalRows(rows).length,
    installments: principalRows(rows).map(row => ({
      id: row.id, installmentNumber: row.installmentNumber, creditAmount: row.creditAmount,
      interestAmount: row.interestAmount, paymentDate: installmentDate(row) ?? undefined
    })),
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
    installmentsDelta: previous.installmentsRemaining == null || current.installmentsRemaining == null ? null :
      current.installmentsRemaining - previous.installmentsRemaining,
    estimatedInterestSaved: estimateInterestSaved(previous, current),
    termDifferenceMonths: before && after ?
      (Number(after.slice(0, 4)) - Number(before.slice(0, 4))) * 12 +
      Number(after.slice(5, 7)) - Number(before.slice(5, 7)) : null
  };
};
