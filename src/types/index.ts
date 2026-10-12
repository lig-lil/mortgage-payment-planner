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
  originalPrincipal?: number;
  originalPrincipalLocked?: boolean;
  contractedPeriod?: string;
  /** @deprecated Kept for compatibility with previously stored schedules. */
  contractedYear?: string;
  totalInstallmentsOverride?: number;
  totalInstallmentsLocked?: boolean;
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

/** Real active PDF at replacement time. Never contains scenario or Planner inputs. */
export interface PreviousScheduleSnapshot {
  boundaryVersion?: 'actual-v2';
  sourceFileName: string;
  extractedAt: string;
  firstUnpaidRowId: string | null;
  principalRemaining: number;
  installmentsRemaining?: number;
  installments?: ScheduleRow[];
  finalPaymentDate: string | null;
  remainingInterest?: number | null;
}

export interface ScheduleComparison {
  previous: PreviousScheduleSnapshot;
  current: PreviousScheduleSnapshot;
  /** Signed current minus previous; a negative value is an observed reduction. */
  principalDelta: number;
  remainingInterestDelta: number | null;
  installmentsDelta: number | null;
  estimatedInterestSaved: { amount: number; startDate: string | null; installmentNumber: number } | null;
  termDifferenceMonths: number | null;
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
  monthsCovered: number;
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
  scenarioType?: 'amount' | 'months' | 'interest';
  result: CalculationResult;
  referenceSchedule?: ScheduleReference;
  input?: ScenarioInput;
  assumptions?: { engineVersion: 'legacy-v1'; lastInterestAmount?: number };
}

export interface LoanDetails {
  originalLoanAmount: number | null;
  originalLoanAmountConfirmed: boolean;
  startMonth?: string;
  legacy?: Pick<ExtractionMeta, 'originalPrincipal' | 'originalPrincipalLocked' | 'contractedPeriod' | 'contractedYear'>;
}

export interface ScheduleReference {
  sourceFileName: string | null;
  extractedAt: string | null;
  /** Exact canonical calculation inputs; detects uploads and manual corrections. */
  version: string;
}

export interface ScenarioInput {
  type: 'amount' | 'months' | 'interest';
  value: number;
  firstUnpaidRowId: string;
  newInterestAmount?: number;
}

export interface ActualMortgageState {
  outstandingPrincipal: number | null;
  firstUnpaidInstallment: ScheduleRow | null;
  nextInstallmentDate: string | null;
  nextInstallmentAmount: number | null;
  nextPrincipal: number | null;
  nextInterest: number | null;
  installmentsRemaining: number | null;
  lastScheduledPaymentDate: string | null;
  remainingInterest: number | null;
  totalRemainingScheduledPayments: number | null;
  principalRepaid: { amount: number | null; percentage: number | null; reason: string | null };
  sourceFileName: string | null;
  extractedAt: string | null;
}

export interface AppStateSnapshot {
  rows: ScheduleRow[];
  firstUnpaidRowId: string | null;
  firstUnpaidInstallment?: number | null;
  warnings: AppWarning[];
  meta: ExtractionMeta | null;
  recentResults: StoredCalculationResult[];
}
