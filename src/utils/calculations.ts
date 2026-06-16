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

const addMonths = (isoDate: string, monthsToAdd: number): string | null => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const targetMonthIndex = date.getUTCMonth() + monthsToAdd;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(date.getUTCDate(), daysInMonth(targetYear, normalizedMonthIndex));

  return new Date(Date.UTC(targetYear, normalizedMonthIndex, targetDay)).toISOString().slice(0, 10);
};

const subtractMonths = (isoDate: string, monthsToSubtract: number): string | null =>
  addMonths(isoDate, -monthsToSubtract);

const getLastScheduledPaymentDate = (rows: ScheduleRow[]): string | null => {
  const scheduledDates = rows
    .map(getRowPaymentDate)
    .filter((paymentDate): paymentDate is string => Boolean(paymentDate))
    .sort();

  return scheduledDates[scheduledDates.length - 1] ?? null;
};

const calculateAdjustedTerm = (
  paymentRows: ScheduleRow[],
  startIndex: number,
  prepaidMonths: number,
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
  const adjustedLastPaymentDate = firstUnpaidPaymentDate
    ? addMonths(firstUnpaidPaymentDate, fallbackRemainingMonths - 1)
    : null;

  if (!firstUnpaidPaymentDate || !adjustedLastPaymentDate) {
    return {
      remainingMonths: fallbackRemainingMonths,
      lastPaymentDateLabel: calculateLastPaymentDateLabel(paymentRows, prepaidMonths)
    };
  }

  return {
    remainingMonths: fallbackRemainingMonths,
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

  const paymentRows = principalRows(sanitizedRows);
  const duplicates = findDuplicateInstallments(paymentRows);
  if (duplicates.length > 0) {
    throw new Error('Duplicate installment numbers detected.');
  }

  const startIndex = paymentRows.findIndex((row) => row.id === firstUnpaidRowId);

  if (!firstUnpaidRowId || startIndex < 0) {
    throw new Error('Please select a valid first unpaid installment.');
  }

  return {
    paymentRows,
    remainingPrincipalRows: paymentRows.slice(startIndex),
    startIndex,
    firstUnpaidInstallment: startIndex + 1
  };
};

type RatePeriod = {
  monthlyRate: number;
  monthlyPayment: number;
  startsAtMonthIndex: number;
};

type DerivedRatePoint = RatePeriod & {
  monthIndex: number;
};

const median = (values: number[]): number => {
  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex];
  }

  return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
};

const deriveRatePeriods = (paymentRows: ScheduleRow[], startIndex: number): RatePeriod[] => {
  const remainingPrincipalRows = paymentRows.slice(startIndex);
  const totalRemainingPrincipal = remainingPrincipalRows.reduce(
    (sum, row) => sum + row.creditAmount,
    0
  );
  let runningBalance = totalRemainingPrincipal;
  const ratePoints: DerivedRatePoint[] = [];

  remainingPrincipalRows.forEach((row, monthIndex) => {
    const rowWithInterest = withDerivedSavingsColumns(row);
    const interestAmount = rowWithInterest.interestAmount;

    if (
      interestAmount != null &&
      Number.isFinite(interestAmount) &&
      interestAmount >= 0 &&
      runningBalance > 0
    ) {
      const monthlyRate = interestAmount / runningBalance;
      const monthlyPayment = row.creditAmount + interestAmount;

      if (
        Number.isFinite(monthlyRate) &&
        monthlyRate >= 0 &&
        Number.isFinite(monthlyPayment) &&
        monthlyPayment > 0
      ) {
        ratePoints.push({
          monthlyRate,
          monthlyPayment,
          startsAtMonthIndex: monthIndex,
          monthIndex
        });
      }
    }

    runningBalance -= row.creditAmount;
  });

  if (ratePoints.length < 2) {
    return [];
  }

  const periodGroups: DerivedRatePoint[][] = [];

  ratePoints.forEach((ratePoint) => {
    const currentGroup = periodGroups[periodGroups.length - 1];
    const previousPoint = currentGroup?.[currentGroup.length - 1];

    if (
      !currentGroup ||
      !previousPoint ||
      Math.abs(ratePoint.monthlyPayment - previousPoint.monthlyPayment) > 1
    ) {
      periodGroups.push([ratePoint]);
      return;
    }

    currentGroup.push(ratePoint);
  });

  return periodGroups.map((group) => ({
    monthlyRate: median(group.map((point) => point.monthlyRate)),
    monthlyPayment: median(group.map((point) => point.monthlyPayment)),
    startsAtMonthIndex: group[0].startsAtMonthIndex
  }));
};

const reamortize = (params: {
  balance: number;
  periods: RatePeriod[];
  monthlyExtraPayment?: number;
}): {
  remainingMonths: number;
  totalInterestPaid: number;
} => {
  let balance = params.balance;

  if (balance <= 0) {
    return {
      remainingMonths: 0,
      totalInterestPaid: 0
    };
  }

  let monthCount = 0;
  let periodIndex = 0;
  let totalInterestPaid = 0;
  const monthlyExtraPayment = params.monthlyExtraPayment ?? 0;

  while (balance > 0) {
    if (
      periodIndex + 1 < params.periods.length &&
      monthCount >= params.periods[periodIndex + 1].startsAtMonthIndex
    ) {
      periodIndex += 1;
    }

    const { monthlyRate, monthlyPayment } = params.periods[periodIndex];
    const interest = balance * monthlyRate;
    const regularPrincipal = monthlyPayment - interest;
    const totalPrincipal = regularPrincipal + monthlyExtraPayment;

    if (totalPrincipal <= 0) {
      break;
    }

    totalInterestPaid += interest;
    monthCount += 1;

    if (totalPrincipal >= balance) {
      balance = 0;
      break;
    }

    balance -= totalPrincipal;
  }

  return {
    remainingMonths: monthCount,
    totalInterestPaid
  };
};

const getLastCoveredInstallmentNumbers = (
  remainingPrincipalRows: ScheduleRow[],
  monthsCovered: number
): number[] =>
  monthsCovered <= 0
    ? []
    : remainingPrincipalRows.slice(-monthsCovered).map((row) => row.installmentNumber);

const sumLastPrincipalCents = (
  remainingPrincipalRows: ScheduleRow[],
  monthsCovered: number
): number => {
  if (monthsCovered <= 0) {
    return 0;
  }

  return remainingPrincipalRows
    .slice(-monthsCovered)
    .reduce((sum, row) => sum + toCents(row.creditAmount), 0);
};

const findMinimumPrepaymentForSameCoverageCents = (params: {
  remainingPrincipalRows: ScheduleRow[];
  totalRemainingCents: number;
  periods: RatePeriod[];
  monthsCovered: number;
  remainingMonths: number;
}): number => {
  if (params.monthsCovered <= 0) {
    return 0;
  }

  let minimumCents = sumLastPrincipalCents(params.remainingPrincipalRows, params.monthsCovered);

  for (let coveredMonths = params.monthsCovered - 1; coveredMonths >= 0; coveredMonths -= 1) {
    const candidateCents = sumLastPrincipalCents(params.remainingPrincipalRows, coveredMonths);
    const candidateResult = reamortize({
      balance: fromCents(params.totalRemainingCents - candidateCents),
      periods: params.periods
    });

    if (candidateResult.remainingMonths > params.remainingMonths) {
      break;
    }

    minimumCents = candidateCents;
  }

  return minimumCents;
};

const calculateByAmountUsingRowCounting = (params: {
  paymentRows: ScheduleRow[];
  remainingPrincipalRows: ScheduleRow[];
  startIndex: number;
  firstUnpaidInstallment: number;
  firstUnpaidRowId: string;
  targetCents: number;
  totalRemainingCents: number;
}): AmountCalculationResult => {
  let coveredCents = 0;
  const installmentNumbersCovered: number[] = [];

  for (const row of params.remainingPrincipalRows) {
    const nextCents = toCents(row.creditAmount);

    if (coveredCents + nextCents > params.targetCents) {
      break;
    }

    coveredCents += nextCents;
    installmentNumbersCovered.push(params.startIndex + installmentNumbersCovered.length + 1);
  }

  const monthsCovered = installmentNumbersCovered.length;
  const unusedAmountCents = Math.max(0, params.targetCents - coveredCents);
  const fallbackRemainingMonths = Math.max(0, params.remainingPrincipalRows.length - monthsCovered);
  const adjustedTerm = calculateAdjustedTerm(
    params.paymentRows,
    params.startIndex,
    monthsCovered,
    fallbackRemainingMonths
  );
  const remainingCreditCents = Math.max(
    0,
    params.totalRemainingCents - coveredCents - unusedAmountCents
  );

  return {
    type: 'amount',
    firstUnpaidRowId: params.firstUnpaidRowId,
    firstUnpaidInstallment: params.firstUnpaidInstallment,
    monthsCovered,
    totalCreditCovered: fromCents(coveredCents),
    remainingCredit: fromCents(remainingCreditCents),
    unusedAmount: fromCents(unusedAmountCents),
    remainingMonths: adjustedTerm.remainingMonths,
    remainingYearsLabel: formatRemainingYears(adjustedTerm.remainingMonths),
    lastPaymentDateLabel: adjustedTerm.lastPaymentDateLabel,
    installmentNumbersCovered,
    totalScheduleMonths: params.paymentRows.length
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
  const periods = deriveRatePeriods(paymentRows, startIndex);

  if (periods.length === 0) {
    console.warn(
      'Unable to derive early-payment interest rates from the schedule; using row-counting fallback.'
    );
    return calculateByAmountUsingRowCounting({
      paymentRows,
      remainingPrincipalRows,
      startIndex,
      firstUnpaidInstallment,
      firstUnpaidRowId: params.firstUnpaidRowId,
      targetCents,
      totalRemainingCents
    });
  }

  const prepaidCents = Math.min(targetCents, totalRemainingCents);
  const amortizedResult = reamortize({
    balance: fromCents(totalRemainingCents - prepaidCents),
    periods
  });
  const remainingMonths = amortizedResult.remainingMonths;
  const monthsCovered = Math.max(0, remainingPrincipalRows.length - remainingMonths);
  const installmentNumbersCovered = getLastCoveredInstallmentNumbers(
    remainingPrincipalRows,
    monthsCovered
  );
  const adjustedTerm = calculateAdjustedTerm(
    paymentRows,
    startIndex,
    monthsCovered,
    remainingMonths
  );
  const remainingCreditCents = Math.max(0, totalRemainingCents - prepaidCents);
  const minimumForSameCoverageCents = findMinimumPrepaymentForSameCoverageCents({
    remainingPrincipalRows,
    totalRemainingCents,
    periods,
    monthsCovered,
    remainingMonths
  });
  const unusedAmountCents = Math.max(0, prepaidCents - minimumForSameCoverageCents);

  return {
    type: 'amount',
    firstUnpaidRowId: params.firstUnpaidRowId,
    firstUnpaidInstallment,
    monthsCovered,
    totalCreditCovered: fromCents(prepaidCents),
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

  const totalRemainingCents = remainingPrincipalRows.reduce(
    (sum, row) => sum + toCents(row.creditAmount),
    0
  );
  const selectedRows = remainingPrincipalRows.slice(0, monthsToCover);
  const selectedCents = selectedRows.reduce((sum, row) => sum + toCents(row.creditAmount), 0);
  const periods = deriveRatePeriods(paymentRows, startIndex);

  if (periods.length === 0) {
    console.warn(
      'Unable to derive early-payment interest rates from the schedule; using row-summing fallback.'
    );
    const fallbackRemainingMonths = availableMonths - monthsToCover;
    const adjustedTerm = calculateAdjustedTerm(
      paymentRows,
      startIndex,
      selectedRows.length,
      fallbackRemainingMonths
    );

    return {
      type: 'months',
      firstUnpaidRowId: params.firstUnpaidRowId,
      firstUnpaidInstallment,
      monthsRequested: monthsToCover,
      monthsCovered: monthsToCover,
      totalAmountRequired: fromCents(selectedCents),
      remainingCredit: fromCents(Math.max(0, totalRemainingCents - selectedCents)),
      remainingMonths: adjustedTerm.remainingMonths,
      remainingYearsLabel: formatRemainingYears(adjustedTerm.remainingMonths),
      lastPaymentDateLabel: adjustedTerm.lastPaymentDateLabel,
      installmentNumbersCovered: selectedRows.map((row) => row.installmentNumber),
      totalScheduleMonths: paymentRows.length
    };
  }

  const newBalanceCents = Math.max(0, totalRemainingCents - selectedCents);
  const amortizedResult = reamortize({
    balance: fromCents(newBalanceCents),
    periods
  });
  const actualMonthsCovered = Math.min(
    availableMonths,
    Math.max(0, availableMonths - amortizedResult.remainingMonths)
  );
  const adjustedTerm = calculateAdjustedTerm(
    paymentRows,
    startIndex,
    actualMonthsCovered,
    amortizedResult.remainingMonths
  );
  const installmentNumbersCovered = getLastCoveredInstallmentNumbers(
    remainingPrincipalRows,
    actualMonthsCovered
  );

  return {
    type: 'months',
    firstUnpaidRowId: params.firstUnpaidRowId,
    firstUnpaidInstallment,
    monthsRequested: monthsToCover,
    monthsCovered: actualMonthsCovered,
    totalAmountRequired: fromCents(selectedCents),
    remainingCredit: fromCents(newBalanceCents),
    remainingMonths: adjustedTerm.remainingMonths,
    remainingYearsLabel: formatRemainingYears(adjustedTerm.remainingMonths),
    lastPaymentDateLabel: adjustedTerm.lastPaymentDateLabel,
    installmentNumbersCovered,
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

  const paymentRows = principalRows(sanitizedRows);
  const duplicates = findDuplicateInstallments(paymentRows);
  if (duplicates.length > 0) {
    throw new Error('Duplicate installment numbers detected.');
  }

  const startIndex = paymentRows.findIndex((row) => row.id === params.result.firstUnpaidRowId);

  if (startIndex < 0) {
    throw new Error('Run a principal calculation before calculating planning estimates.');
  }

  const existingCoveredMonths =
    params.result.monthsCovered ?? params.result.installmentNumbersCovered.length;
  const resultRemainingMonths = Math.max(0, params.result.remainingMonths);
  const currentBalanceCents = toCents(params.result.remainingCredit);
  const remainingRows = paymentRows.slice(
    startIndex,
    startIndex + resultRemainingMonths
  );

  if (resultRemainingMonths <= 0 || currentBalanceCents <= 0) {
    return {
      monthlyReimbursement: fromCents(toCents(monthlyReimbursement)),
      estimatedRemainingMonths: 0,
      estimatedRemainingYearsLabel: formatRemainingYears(0),
      estimatedLastPaymentDateLabel: ''
    };
  }

  const monthlyReimbursementCents = toCents(monthlyReimbursement);
  const periods = deriveRatePeriods(paymentRows, startIndex);

  if (periods.length === 0) {
    console.warn(
      'Unable to derive early-payment interest rates from the schedule; using row-counting fallback.'
    );
    if (!remainingRows.length) {
      return {
        monthlyReimbursement: fromCents(monthlyReimbursementCents),
        estimatedRemainingMonths: 0,
        estimatedRemainingYearsLabel: formatRemainingYears(0),
        estimatedLastPaymentDateLabel: ''
      };
    }

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
      existingCoveredMonths + additionalCoveredMonths
    );

    return {
      monthlyReimbursement: fromCents(monthlyReimbursementCents),
      estimatedRemainingMonths,
      estimatedRemainingYearsLabel: formatRemainingYears(estimatedRemainingMonths),
      estimatedLastPaymentDateLabel
    };
  }

  const result = reamortize({
    balance: fromCents(currentBalanceCents),
    periods,
    monthlyExtraPayment: fromCents(monthlyReimbursementCents)
  });
  const additionalCoveredMonths = Math.max(0, resultRemainingMonths - result.remainingMonths);
  const adjustedTerm = calculateAdjustedTerm(
    paymentRows,
    startIndex,
    existingCoveredMonths + additionalCoveredMonths,
    result.remainingMonths
  );

  return {
    monthlyReimbursement: fromCents(monthlyReimbursementCents),
    estimatedRemainingMonths: adjustedTerm.remainingMonths,
    estimatedRemainingYearsLabel: formatRemainingYears(adjustedTerm.remainingMonths),
    estimatedLastPaymentDateLabel: adjustedTerm.lastPaymentDateLabel
  };
};
