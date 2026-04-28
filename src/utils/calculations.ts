import {
  AmountCalculationResult,
  MonthsCalculationResult,
  ScheduleRow
} from '../types';
import { fromCents, parseFlexibleNumber, parsePositiveInteger, toCents } from './number';
import { findDuplicateInstallments, sanitizeRows, sortRows } from './rows';

const validateBaseInputs = (
  rows: ScheduleRow[],
  firstUnpaidInstallment: number
): { sortedRows: ScheduleRow[]; startIndex: number } => {
  const sanitizedRows = sortRows(sanitizeRows(rows));

  if (!sanitizedRows.length) {
    throw new Error('Please upload a PDF first.');
  }

  const duplicates = findDuplicateInstallments(sanitizedRows);
  if (duplicates.length > 0) {
    throw new Error('Duplicate installment numbers detected.');
  }

  const startIndex = sanitizedRows.findIndex(
    (row) => row.installmentNumber === firstUnpaidInstallment
  );

  if (startIndex === -1) {
    throw new Error('The selected first unpaid installment was not found.');
  }

  return { sortedRows: sanitizedRows, startIndex };
};

export const calculateByAmount = (params: {
  rows: ScheduleRow[];
  firstUnpaidInstallment: number;
  amount: number;
}): AmountCalculationResult => {
  const amount = parseFlexibleNumber(params.amount);

  if (amount == null || amount <= 0) {
    throw new Error('Please enter an amount greater than 0.');
  }

  const { sortedRows, startIndex } = validateBaseInputs(
    params.rows,
    params.firstUnpaidInstallment
  );

  const targetCents = toCents(amount);
  const totalRemainingCents = sortedRows
    .slice(startIndex)
    .reduce((sum, row) => sum + toCents(row.creditAmount), 0);
  let coveredCents = 0;
  const installmentNumbersCovered: number[] = [];

  for (let index = startIndex; index < sortedRows.length; index += 1) {
    const row = sortedRows[index];
    const nextCents = toCents(row.creditAmount);

    if (coveredCents + nextCents > targetCents) {
      break;
    }

    coveredCents += nextCents;
    installmentNumbersCovered.push(row.installmentNumber);
  }

  return {
    type: 'amount',
    firstUnpaidInstallment: params.firstUnpaidInstallment,
    monthsCovered: installmentNumbersCovered.length,
    totalCreditCovered: fromCents(coveredCents),
    remainingCredit: fromCents(Math.max(0, totalRemainingCents - coveredCents)),
    unusedAmount: fromCents(targetCents - coveredCents),
    remainingMonths:
      sortedRows.length - startIndex - installmentNumbersCovered.length,
    installmentNumbersCovered,
    totalScheduleMonths: sortedRows.length
  };
};

export const calculateByMonths = (params: {
  rows: ScheduleRow[];
  firstUnpaidInstallment: number;
  monthsToCover: number;
}): MonthsCalculationResult => {
  const monthsToCover = parsePositiveInteger(params.monthsToCover);

  if (monthsToCover == null || monthsToCover <= 0) {
    throw new Error('Please enter a number of months greater than 0.');
  }

  const { sortedRows, startIndex } = validateBaseInputs(
    params.rows,
    params.firstUnpaidInstallment
  );
  const availableMonths = sortedRows.length - startIndex;

  if (monthsToCover > availableMonths) {
    throw new Error(
      `Only ${availableMonths} month(s) are available from installment ${params.firstUnpaidInstallment}.`
    );
  }

  const selectedRows = sortedRows.slice(startIndex, startIndex + monthsToCover);
  const totalRemainingCents = sortedRows
    .slice(startIndex)
    .reduce((sum, row) => sum + toCents(row.creditAmount), 0);
  const totalAmountRequired = fromCents(
    selectedRows.reduce((sum, row) => sum + toCents(row.creditAmount), 0)
  );

  return {
    type: 'months',
    firstUnpaidInstallment: params.firstUnpaidInstallment,
    monthsRequested: monthsToCover,
    totalAmountRequired,
    remainingCredit: fromCents(Math.max(0, totalRemainingCents - toCents(totalAmountRequired))),
    remainingMonths: availableMonths - monthsToCover,
    installmentNumbersCovered: selectedRows.map((row) => row.installmentNumber),
    totalScheduleMonths: sortedRows.length
  };
};
