import { CurrentMortgageCard } from './CurrentMortgageCard';
import { LatestScenarioCard } from './LatestScenarioCard';
import { ScheduleChangesCard } from './ScheduleChangesCard';
import { ExtractionMeta, ScheduleComparison, ScheduleRow, StoredCalculationResult } from '../types';
import { formatMoney } from '../utils/number';
import { actualPrincipalRemaining as getActualPrincipalRemaining, principalRows, rowsSummary } from '../utils/rows';

interface DashboardProps {
  scheduleComparison: ScheduleComparison | null;
  rows: ScheduleRow[];
  firstUnpaidInstallment: number | null;
  meta: ExtractionMeta | null;
  results: StoredCalculationResult[];
  onOpenPlanner: () => void;
  onOpenSchedule: () => void;
  onOpenHistory: () => void;
  onOriginalPrincipalChange: (value: number) => void;
  onOriginalPrincipalLockChange: (locked: boolean) => void;
  onContractedPeriodChange: (value: string) => void;
}

const shortDate = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

export const Dashboard = ({
  scheduleComparison,
  rows,
  firstUnpaidInstallment,
  meta,
  results,
  onOpenPlanner,
  onOpenSchedule,
  onOpenHistory,
  onOriginalPrincipalChange,
  onOriginalPrincipalLockChange,
  onContractedPeriodChange
}: DashboardProps) => {
  const summary = rowsSummary(rows);
  const payments = principalRows(rows);
  const latest = results[0];
  const unpaidIndex = Math.max(0, (firstUnpaidInstallment ?? 1) - 1);
  const actualPrincipalRemaining = getActualPrincipalRemaining(rows);
  const scenarioPrincipalRemaining = latest?.result.remainingCredit;
  const originalPrincipal = meta?.originalPrincipal ?? summary.totalCredit;
  const installmentsLeft =
    latest?.result.remainingMonths ?? Math.max(0, payments.length - unpaidIndex);
  const paidPercent = originalPrincipal
    ? Math.min(
        100,
        Math.max(0, ((originalPrincipal - actualPrincipalRemaining) / originalPrincipal) * 100)
      )
    : 0;
  const lastPayment = latest?.result.lastPaymentDateLabel || '—';
  const principalReduction = scenarioPrincipalRemaining == null
    ? null
    : actualPrincipalRemaining - scenarioPrincipalRemaining;
  const interestSaved = latest?.scenarioType === 'interest'
    ? latest.result.totalInterestSaved
    : undefined;
  const uploadedAt = meta?.extractedAt ? new Date(meta.extractedAt) : null;
  const uploadedDate = uploadedAt && !Number.isNaN(uploadedAt.getTime())
    ? uploadedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="dashboard">
      <div className="dashboard__headline">
        <div>
          <span className="page-kicker">Home</span>
          <h1>Your mortgage at a glance</h1>
        </div>
        <div className="dashboard__headline-actions">
          <button type="button" className="primary-button" onClick={onOpenPlanner}>
            New scenario <span aria-hidden="true">&rarr;</span>
          </button>
          <button type="button" className="secondary-button" onClick={onOpenSchedule}>
            Upload new PDF
          </button>
        </div>
      </div>

      <div className="dashboard__lower-grid">
        <section className="dashboard-panel recent-plans">
          <div className="dashboard-panel__header">
            <h2>Recent plans</h2>
            <button type="button" className="text-button" onClick={onOpenHistory}>
              View all &rarr;
            </button>
          </div>
          {results.length ? (
            <div className="recent-plans__list">
              {results.slice(0, 3).map((entry) => (
                <article key={entry.id} className="recent-plan">
                  <div className="recent-plan__heading">
                    <strong>{entry.result.type === 'amount' ? 'By amount' : 'By months'}</strong>
                    <span className="recent-plan__date">{shortDate(entry.createdAt)}</span>
                  </div>
                  <div className="recent-plan__stats">
                    <span>{entry.result.type === 'amount' ? formatMoney(entry.inputValue) : entry.inputValue + ' selected'}</span>
                    <span>{entry.result.monthsCovered} covered</span>
                    <strong>{formatMoney(entry.result.type === 'amount' ? entry.result.totalCreditCovered : entry.result.totalAmountRequired)}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <p>Your saved scenarios will appear here.</p>
              <button type="button" className="text-button" onClick={onOpenPlanner}>
                Create your first plan &rarr;
              </button>
            </div>
          )}
        </section>
        <section className="dashboard-panel active-schedule">
          <div className="dashboard-panel__header"><h2>Active schedule</h2></div>
          <strong className="active-schedule__name">{meta?.sourceFileName || 'No schedule uploaded'}</strong>
          {meta?.sourceFileName ? (
            <span className="active-schedule__date">{uploadedDate ? 'Uploaded ' + uploadedDate : 'Upload date unavailable'}</span>
          ) : null}
          <span className="active-schedule__date">{meta ? meta.parsedPages + ' pages scanned' : 'Upload a PDF to get started'}</span>
          <dl>
            <div><dt>Rows</dt><dd>{summary.totalRows}</dd></div>
            <div><dt>Installments</dt><dd>{summary.totalInstallments}</dd></div>
            <div><dt>Confidence</dt><dd>{meta ? Math.round((meta.creditColumn.confidence || 0) * 100) + '%' : '-'}</dd></div>
          </dl>
          <button type="button" className="text-button" onClick={onOpenSchedule}>Review schedule &rarr;</button>
        </section>
      </div>

      <CurrentMortgageCard
        meta={meta}
        actualPrincipalRemaining={actualPrincipalRemaining}
        originalPrincipal={originalPrincipal}
        paidPercent={paidPercent}
        totalInstallments={summary.totalInstallments}
        onOriginalPrincipalChange={onOriginalPrincipalChange}
        onOriginalPrincipalLockChange={onOriginalPrincipalLockChange}
        onContractedPeriodChange={onContractedPeriodChange}
      />

      <LatestScenarioCard
        latest={latest}
        principalRemaining={scenarioPrincipalRemaining}
        principalReduction={principalReduction}
        firstUnpaidInstallment={firstUnpaidInstallment}
        installmentsLeft={installmentsLeft}
        lastPayment={lastPayment}
        interestSaved={interestSaved}
        onOpenPlanner={onOpenPlanner}
      />
      <ScheduleChangesCard comparison={scheduleComparison} />
    </div>
  );
};
