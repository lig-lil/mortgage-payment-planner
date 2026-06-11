export type WarningSeverity = 'info' | 'warning' | 'error';

export interface AppWarning {
  id: string;
  message: string;
  severity: WarningSeverity;
}

export interface ScheduleRow {
  id: string;
  installmentNumber: number;
  creditAmount: number;
  interestAmount?: number;
  paymentDate?: string;
  rawRowData?: Record<string, string>;
  sourcePage?: number;
  sourceRowIndex?: number;
}

export interface ColumnDetection {
  confidence: number;
  label?: string;
}

export interface ExtractionMeta {
  sourceFileName: string;
  parsedPages: number;
  installmentColumn: ColumnDetection;
  creditColumn: ColumnDetection;
  interestColumn?: ColumnDetection;
  lastInterestAmount?: number;
  extractedAt: string;
}

export interface PdfParseResult {
  rows: ScheduleRow[];
  warnings: AppWarning[];
  meta: ExtractionMeta;
}

export interface AmountCalculationResult {
  type: 'amount';
  firstUnpaidRowId: string;
  firstUnpaidInstallment: number;
  monthsCovered: number;
  totalCreditCovered: number;
  remainingCredit: number;
  unusedAmount: number;
  remainingMonths: number;
  remainingYearsLabel: string;
  lastPaymentDateLabel: string;
  totalInterestSaved?: number;
  newInterestAmount?: number;
  installmentNumbersCovered: number[];
  totalScheduleMonths: number;
}

export interface MonthsCalculationResult {
  type: 'months';
  firstUnpaidRowId: string;
  firstUnpaidInstallment: number;
  monthsRequested: number;
  totalAmountRequired: number;
  remainingCredit: number;
  remainingMonths: number;
  remainingYearsLabel: string;
  lastPaymentDateLabel: string;
  totalInterestSaved?: number;
  newInterestAmount?: number;
  installmentNumbersCovered: number[];
  totalScheduleMonths: number;
}

export type CalculationResult = AmountCalculationResult | MonthsCalculationResult;

export interface PlanningCalculationResult {
  monthlyReimbursement: number;
  estimatedRemainingMonths: number;
  estimatedRemainingYearsLabel: string;
  estimatedLastPaymentDateLabel: string;
}

export interface StoredCalculationResult {
  id: string;
  createdAt: string;
  inputValue: number;
  result: CalculationResult;
}

export interface AppStateSnapshot {
  rows: ScheduleRow[];
  firstUnpaidRowId: string | null;
  firstUnpaidInstallment?: number | null;
  warnings: AppWarning[];
  meta: ExtractionMeta | null;
  recentResults: StoredCalculationResult[];
}
