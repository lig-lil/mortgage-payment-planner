import { ScheduleRow } from '../types';
import { formatEditableMoney, parseFlexibleNumber, parsePositiveInteger } from './number';

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
  rawRowData: partial.rawRowData,
  sourcePage: partial.sourcePage,
  sourceRowIndex: partial.sourceRowIndex
});

export const sortRows = (rows: ScheduleRow[]): ScheduleRow[] =>
  [...rows].sort((left, right) => left.installmentNumber - right.installmentNumber);

export const sanitizeRows = (rows: ScheduleRow[]): ScheduleRow[] =>
  rows
    .map((row) => {
      const installmentNumber = parsePositiveInteger(row.installmentNumber);
      const creditAmount = parseFlexibleNumber(row.creditAmount);

      if (installmentNumber == null || creditAmount == null || creditAmount < 0) {
        return null;
      }

      return createScheduleRow({
        ...row,
        installmentNumber,
        creditAmount
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
  const orderedRows = sortRows(rows);

  return {
    totalRows: rows.length,
    totalCredit: rows.reduce((sum, row) => sum + row.creditAmount, 0),
    firstInstallment: orderedRows.length ? orderedRows[0].installmentNumber : null,
    lastInstallment: orderedRows.length
      ? orderedRows[orderedRows.length - 1]?.installmentNumber ?? null
      : null
  };
};

export const rowToExport = (row: ScheduleRow) => ({
  installmentNumber: row.installmentNumber,
  creditAmount: formatEditableMoney(row.creditAmount),
  rawRowData: row.rawRowData,
  sourcePage: row.sourcePage,
  sourceRowIndex: row.sourceRowIndex
});
