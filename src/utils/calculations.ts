import {
  AmountCalculationResult,
  CalculationResult,
  MonthsCalculationResult,
  PlanningCalculationResult,
  ScheduleRow
} from '../types';
import { fromCents, parseFlexibleNumber, parsePositiveInteger, toCents } from './number';
import {
  findDuplicateInstallments,
  principalRows,
  sanitizeRows,
  sortRows
} from './rows';
import { formatScheduleDate, parseScheduleDateFromText } from './scheduleDate';

const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const getRowPaymentDate = (row: ScheduleRow): string | null => {
  if (row.paymentDate) {
    return row.paymentDate;
  }

  const rawValues = Object.values(row.rawRowData ?? {});

  for (const rawValue of rawValues) {
    const parsedDate = parseScheduleDateFromText(rawValue);

    if (parsedDate) {
      return parsedDate;
    }
  }

  return null;
};

const parseRawRowSegments = (row: ScheduleRow): string[] =>
  (row.rawRowData?.segmentText ?? '')
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);

const parseMoneySegment = (segment: string): number | null =>
  parseScheduleDateFromText(segment) ? null : parseFlexibleNumber(segment);

const getRawCellIndex = (segments: string[], cellValue: string | undefined): number => {
  if (!cellValue) {
    return -1;
  }

  return segments.findIndex((segment) => segment === cellValue.trim());
};

const getCreditCellIndex = (row: ScheduleRow, segments: string[]): number => {
  const explicitIndex = getRawCellIndex(segments, row.rawRowData?.creditCell);

  if (explicitIndex >= 0) {
    return explicitIndex;
  }

  return segments.findIndex((segment) => parseMoneySegment(segment) === row.creditAmount);
};

const inferInterestAfterPrincipal = (row: ScheduleRow): number | undefined => {
  const segments = parseRawRowSegments(row);
  const creditIndex = getCreditCellIndex(row, segments);

  if (creditIndex < 0) {
    return undefined;
  }

  return segments
    .slice(creditIndex + 1)
    .map(parseMoneySegment)
    .find((value): value is number => value != null);
};

const getRowInterestAmount = (row: ScheduleRow): number | undefined => {
  const inferred = inferInterestAfterPrincipal(row);

  if (inferred != null) {
    return inferred;
  }

  if (row.interestAmount != null) {
    return row.interestAmount;
  }

  const rawInterest = parseFlexibleNumber(row.rawRowData?.interestCell);

  if (rawInterest != null) {
    return rawInterest;
  }

  return undefined;
};

const withDerivedSavingsColumns = (row: ScheduleRow): ScheduleRow => ({
  ...row,
  interestAmount: getRowInterestAmount(row)
});

const subtractMonths = (isoDate: string, monthsToSubtract: number): string | null => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const targetMonthIndex = date.getUTCMonth() - monthsToSubtract;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(date.getUTCDate(), daysInMonth(targetYear, normalizedMonthIndex));

  return new Date(Date.UTC(targetYear, normalizedMonthIndex, targetDay)).toISOString().slice(0, 10);
};

const getLastScheduledPaymentDate = (rows: ScheduleRow[]): string | null => {
  const scheduledDates = rows
    .map(getRowPaymentDate)
    .filter((paymentDate): paymentDate is string => Boolean(paymentDate))
    .sort();

  return scheduledDates[scheduledDates.length - 1] ?? null;
};

const countInclusivePaymentMonths = (startIsoDate: string, endIsoDate: string): number => {
  const startDate = new Date(`${startIsoDate}T00:00:00.000Z`);
  const endDate = new Date(`${endIsoDate}T00:00:00.000Z`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  const months =
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (endDate.getUTCMonth() - startDate.getUTCMonth()) +
    1;

  return Math.max(0, months);
};

const calculateAdjustedTerm = (
  paymentRows: ScheduleRow[],
  startIndex: number,
  paidMonths: number,
  fallbackRemainingMonths: number
): {
  remainingMonths: number;
  lastPaymentDateLabel: string;
} => {
  if (fallbackRemainingMonths <= 0) {
    return {
      remainingMonths: 0,
      lastPaymentDateLabel: ''
    };
  }

  const firstUnpaidPaymentDate = getRowPaymentDate(paymentRows[startIndex]);
  const lastScheduledDate = getLastScheduledPaymentDate(paymentRows);
  const adjustedLastPaymentDate = lastScheduledDate
    ? subtractMonths(lastScheduledDate, paidMonths)
    : null;

  if (!firstUnpaidPaymentDate || !adjustedLastPaymentDate) {
    return {
      remainingMonths: fallbackRemainingMonths,
      lastPaymentDateLabel: calculateLastPaymentDateLabel(paymentRows, paidMonths)
    };
  }

  return {
    remainingMonths: countInclusivePaymentMonths(firstUnpaidPaymentDate, adjustedLastPaymentDate),
    lastPaymentDateLabel: formatScheduleDate(adjustedLastPaymentDate)
  };
};

export const calculateLastPaymentDateLabel = (
  rows: ScheduleRow[],
  coveredMonths: number
): string => {
  const lastScheduledDate = getLastScheduledPaymentDate(rows);

  if (!lastScheduledDate) {
    return '';
  }

  const adjustedDate = subtractMonths(lastScheduledDate, coveredMonths);

  return adjustedDate ? formatScheduleDate(adjustedDate) : '';
};

export const formatRemainingYears = (remainingInstallments: number): string => {
  const years = Math.floor(remainingInstallments / 12);
  const months = remainingInstallments % 12;

  if (years === 0) {
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }

  if (months === 0) {
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }

  return `${years} ${years === 1 ? 'year' : 'years'} and ${months} ${
    months === 1 ? 'month' : 'months'
  }`;
};

export const calculateInterestSavings = (params: {
  rows: ScheduleRow[];
  result: CalculationResult;
  newInterestAmount: number;
  lastInterestAmount?: number;
}): Pick<CalculationResult, 'newInterestAmount' | 'totalInterestSaved'> => {
  const newInterestAmount = parseFlexibleNumber(params.newInterestAmount);

  if (newInterestAmount == null || newInterestAmount < 0) {
    throw new Error('Please enter a valid new interest amount.');
  }

  const paymentRows = principalRows(sortRows(sanitizeRows(params.rows))).map(
    withDerivedSavingsColumns
  );
  const interestRows = paymentRows.filter((row) => row.interestAmount != null);
  const totalMonthlyInterestCents = interestRows.reduce(
    (sum, row) => sum + toCents(row.interestAmount ?? 0),
    0
  );
  const firstInterestCents = toCents(paymentRows[0]?.interestAmount ?? Number.NaN);
  const extractedLastInterestCents = toCents(params.lastInterestAmount ?? Number.NaN);
  const lastInterestCents =
    Number.isFinite(extractedLastInterestCents) &&
    extractedLastInterestCents >= totalMonthlyInterestCents * 0.9
      ? extractedLastInterestCents
      : totalMonthlyInterestCents;

  if (!Number.isFinite(firstInterestCents) || !Number.isFinite(lastInterestCents)) {
    throw new Error('The interest column could not be read from the uploaded PDF.');
  }

  if (!parseScheduleDateFromText(params.result.lastPaymentDateLabel)) {
    throw new Error('Run a principal calculation before calculating interest saved.');
  }

  const newInterestCents = toCents(newInterestAmount);
  const totalInterestSavedCents = lastInterestCents - firstInterestCents - newInterestCents;

  return {
    newInterestAmount: fromCents(newInterestCents),
    totalInterestSaved: fromCents(totalInterestSavedCents)
  };
};

const validateBaseInputs = (
  rows: ScheduleRow[],
  firstUnpaidRowId: string
): {
  paymentRows: ScheduleRow[];
  remainingPrincipalRows: ScheduleRow[];
  startIndex: number;
  firstUnpaidInstallment: number;
} => {
  const sanitizedRows = sortRows(sanitizeRows(rows));

  if (!sanitizedRows.length) {
    throw new Error('Please upload a PDF first.');
  }

  const duplicates = findDuplicateInstallments(sanitizedRows);
  if (duplicates.length > 0) {
    throw new Error('Duplicate installment numbers detected.');
  }

  const paymentRows = principalRows(sanitizedRows);
  const startIndex = paymentRows.findIndex((row) => row.id === firstUnpaidRowId);

  if (!firstUnpaidRowId || startIndex < 1) {
    throw new Error('The selected first unpaid installment must start from installment 2.');
  }

  return {
    paymentRows,
    remainingPrincipalRows: paymentRows.slice(startIndex),
    startIndex,
    firstUnpaidInstallment: startIndex + 1
  };
};

export const calculateByAmount = (params: {
  rows: ScheduleRow[];
  firstUnpaidRowId: string;
  amount: number;
}): AmountCalculationResult => {
  const amount = parseFlexibleNumber(params.amount);

  if (amount == null || amount <= 0) {
    throw new Error('Please enter an amount greater than 0.');
  }

  const { paymentRows, remainingPrincipalRows, startIndex, firstUnpaidInstallment } = validateBaseInputs(
    params.rows,
    params.firstUnpaidRowId
  );

  const targetCents = toCents(amount);
  const totalRemainingCents = remainingPrincipalRows.reduce(
    (sum, row) => sum + toCents(row.creditAmount),
    0
  );
  let coveredCents = 0;
  const installmentNumbersCovered: number[] = [];

  for (const row of remainingPrincipalRows) {
    const nextCents = toCents(row.creditAmount);

    if (coveredCents + nextCents > targetCents) {
      break;
    }

    coveredCents += nextCents;
    installmentNumbersCovered.push(row.installmentNumber);
  }

  const monthsCovered = installmentNumbersCovered.length;
  const unusedAmountCents = Math.max(0, targetCents - coveredCents);
  const fallbackRemainingMonths = Math.max(0, remainingPrincipalRows.length - monthsCovered);
  const adjustedTerm = calculateAdjustedTerm(
    paymentRows,
    startIndex,
    startIndex + monthsCovered,
    fallbackRemainingMonths
  );
  const remainingCreditCents = Math.max(
    0,
    totalRemainingCents - coveredCents - unusedAmountCents
  );

  return {
    type: 'amount',
    firstUnpaidRowId: params.firstUnpaidRowId,
    firstUnpaidInstallment,
    monthsCovered,
    totalCreditCovered: fromCents(coveredCents),
    remainingCredit: fromCents(remainingCreditCents),
    unusedAmount: fromCents(unusedAmountCents),
    remainingMonths: adjustedTerm.remainingMonths,
    remainingYearsLabel: formatRemainingYears(adjustedTerm.remainingMonths),
    lastPaymentDateLabel: adjustedTerm.lastPaymentDateLabel,
    installmentNumbersCovered,
    totalScheduleMonths: paymentRows.length
  };
};

export const calculateByMonths = (params: {
  rows: ScheduleRow[];
  firstUnpaidRowId: string;
  monthsToCover: number;
}): MonthsCalculationResult => {
  const monthsToCover = parsePositiveInteger(params.monthsToCover);

  if (monthsToCover == null || monthsToCover <= 0) {
    throw new Error('Please enter a number of months greater than 0.');
  }

  const { paymentRows, remainingPrincipalRows, startIndex, firstUnpaidInstallment } = validateBaseInputs(
    params.rows,
    params.firstUnpaidRowId
  );
  const availableMonths = remainingPrincipalRows.length;

  if (monthsToCover > availableMonths) {
    throw new Error(
      `Only ${availableMonths} month(s) are available from installment ${firstUnpaidInstallment}.`
    );
  }

  const selectedRows = remainingPrincipalRows.slice(0, monthsToCover);
  const totalRemainingCents = remainingPrincipalRows.reduce(
    (sum, row) => sum + toCents(row.creditAmount),
    0
  );
  const selectedCents = selectedRows.reduce((sum, row) => sum + toCents(row.creditAmount), 0);
  const fallbackRemainingMonths = availableMonths - monthsToCover;
  const adjustedTerm = calculateAdjustedTerm(
    paymentRows,
    startIndex,
    startIndex + selectedRows.length,
    fallbackRemainingMonths
  );

  return {
    type: 'months',
    firstUnpaidRowId: params.firstUnpaidRowId,
    firstUnpaidInstallment,
    monthsRequested: monthsToCover,
    totalAmountRequired: fromCents(selectedCents),
    remainingCredit: fromCents(Math.max(0, totalRemainingCents - selectedCents)),
    remainingMonths: adjustedTerm.remainingMonths,
    remainingYearsLabel: formatRemainingYears(adjustedTerm.remainingMonths),
    lastPaymentDateLabel: adjustedTerm.lastPaymentDateLabel,
    installmentNumbersCovered: selectedRows.map((row) => row.installmentNumber),
    totalScheduleMonths: paymentRows.length
  };
};

export const calculateMonthlyReimbursementPlanning = (params: {
  rows: ScheduleRow[];
  result: CalculationResult;
  monthlyReimbursement: string | number;
}): PlanningCalculationResult => {
  const monthlyReimbursement = parseFlexibleNumber(params.monthlyReimbursement);

  if (monthlyReimbursement == null || monthlyReimbursement <= 0) {
    throw new Error('Please enter a monthly reimbursement greater than 0.');
  }

  const sanitizedRows = sortRows(sanitizeRows(params.rows));

  if (!sanitizedRows.length) {
    throw new Error('Please upload a PDF first.');
  }

  const duplicates = findDuplicateInstallments(sanitizedRows);
  if (duplicates.length > 0) {
    throw new Error('Duplicate installment numbers detected.');
  }

  const paymentRows = principalRows(sanitizedRows);
  const startIndex = paymentRows.findIndex((row) => row.id === params.result.firstUnpaidRowId);

  if (startIndex < 1) {
    throw new Error('Run a principal calculation before calculating planning estimates.');
  }

  const existingCoveredMonths = params.result.installmentNumbersCovered.length;
  const planStartIndex = startIndex + existingCoveredMonths;
  const resultRemainingMonths = Math.max(0, params.result.remainingMonths);
  const remainingRows = paymentRows.slice(
    planStartIndex,
    planStartIndex + resultRemainingMonths
  );

  if (resultRemainingMonths <= 0 || !remainingRows.length) {
    return {
      monthlyReimbursement: fromCents(toCents(monthlyReimbursement)),
      estimatedRemainingMonths: 0,
      estimatedRemainingYearsLabel: formatRemainingYears(0),
      estimatedLastPaymentDateLabel: ''
    };
  }

  const monthlyReimbursementCents = toCents(monthlyReimbursement);
  let prepaidPoolCents = 0;
  let remainingIndex = 0;
  let estimatedRemainingMonths = 0;

  while (remainingIndex < remainingRows.length) {
    estimatedRemainingMonths += 1;
    remainingIndex += 1;
    prepaidPoolCents += monthlyReimbursementCents;

    while (
      remainingIndex < remainingRows.length &&
      prepaidPoolCents >= toCents(remainingRows[remainingIndex].creditAmount)
    ) {
      prepaidPoolCents -= toCents(remainingRows[remainingIndex].creditAmount);
      remainingIndex += 1;
    }
  }

  const additionalCoveredMonths = Math.max(0, resultRemainingMonths - estimatedRemainingMonths);
  const estimatedLastPaymentDateLabel = calculateLastPaymentDateLabel(
    paymentRows,
    startIndex + existingCoveredMonths + additionalCoveredMonths
  );

  return {
    monthlyReimbursement: fromCents(monthlyReimbursementCents),
    estimatedRemainingMonths,
    estimatedRemainingYearsLabel: formatRemainingYears(estimatedRemainingMonths),
    estimatedLastPaymentDateLabel
  };
};
