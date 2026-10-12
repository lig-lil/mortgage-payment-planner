import { ScheduleRow } from '../types';
import { formatEditableMoney, parseFlexibleNumber, parsePositiveInteger, toCents } from './number';

export const createRowId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `row-${Math.random().toString(36).slice(2, 10)}`;
};

export const createScheduleRow = (
  partial: Partial<ScheduleRow> = {}
): ScheduleRow => ({
  id: partial.id ?? createRowId(),
  installmentNumber: partial.installmentNumber ?? 1,
  creditAmount: partial.creditAmount ?? 0,
  interestAmount: partial.interestAmount,
  paymentDate: partial.paymentDate,
  rawRowData: partial.rawRowData,
  sourcePage: partial.sourcePage,
  sourceRowIndex: partial.sourceRowIndex
});

export const sortRows = (rows: ScheduleRow[]): ScheduleRow[] =>
  [...rows].sort((left, right) => left.installmentNumber - right.installmentNumber);

export const isPrincipalRow = (row: ScheduleRow): boolean => toCents(row.creditAmount) > 0;

export const principalRows = (rows: ScheduleRow[]): ScheduleRow[] =>
  sortRows(rows).filter(isPrincipalRow);

export const sanitizeRows = (rows: ScheduleRow[]): ScheduleRow[] =>
  rows
    .map((row) => {
      const installmentNumber = parsePositiveInteger(row.installmentNumber);
      const creditAmount = parseFlexibleNumber(row.creditAmount);
      const interestAmount = parseFlexibleNumber(row.interestAmount);

      if (installmentNumber == null || creditAmount == null || creditAmount < 0) {
        return null;
      }

      return createScheduleRow({
        ...row,
        installmentNumber,
        creditAmount,
        interestAmount: interestAmount != null && interestAmount >= 0 ? interestAmount : undefined,
        paymentDate: row.paymentDate
      });
    })
    .filter((row): row is ScheduleRow => Boolean(row));

export const findDuplicateInstallments = (rows: ScheduleRow[]): number[] => {
  const counts = new Map<number, number>();

  rows.forEach((row) => {
    counts.set(row.installmentNumber, (counts.get(row.installmentNumber) ?? 0) + 1);
  });

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([installmentNumber]) => installmentNumber)
    .sort((left, right) => left - right);
};

export const rowsSummary = (rows: ScheduleRow[]) => {
  const paymentRows = principalRows(rows);

  return {
    totalRows: rows.length,
    totalInstallments: paymentRows.length,
    totalCredit: rows.reduce((sum, row) => sum + row.creditAmount, 0),
    firstInstallment: paymentRows.length ? 1 : null,
    lastInstallment: paymentRows.length
  };
};

export const rowToExport = (row: ScheduleRow) => ({
  installmentNumber: row.installmentNumber,
  creditAmount: formatEditableMoney(row.creditAmount),
  interestAmount: row.interestAmount == null ? undefined : formatEditableMoney(row.interestAmount),
  paymentDate: row.paymentDate,
  rawRowData: row.rawRowData,
  sourcePage: row.sourcePage,
  sourceRowIndex: row.sourceRowIndex
});
