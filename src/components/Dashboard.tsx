import { ExtractionMeta, ScheduleRow, StoredCalculationResult } from '../types';
import { formatMoney } from '../utils/number';
import { principalRows, rowsSummary } from '../utils/rows';

interface DashboardProps {
  rows: ScheduleRow[];
  firstUnpaidInstallment: number | null;
  meta: ExtractionMeta | null;
  results: StoredCalculationResult[];
  onOpenPlanner: () => void;
  onOpenSchedule: () => void;
  onOpenHistory: () => void;
}

const shortDate = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

export const Dashboard = ({
  rows,
  firstUnpaidInstallment,
  meta,
  results,
  onOpenPlanner,
  onOpenSchedule,
  onOpenHistory
}: DashboardProps) => {
  const summary = rowsSummary(rows);
  const payments = principalRows(rows);
  const latest = results[0];
  const unpaidIndex = Math.max(0, (firstUnpaidInstallment ?? 1) - 1);
  const scheduledRemaining = payments
    .slice(unpaidIndex)
    .reduce((total, row) => total + row.creditAmount, 0);
  const principalRemaining = latest?.result.remainingCredit ?? scheduledRemaining;
  const installmentsLeft =
    latest?.result.remainingMonths ?? Math.max(0, payments.length - unpaidIndex);
  const paidPercent = summary.totalCredit
    ? Math.min(
        100,
        Math.max(0, ((summary.totalCredit - principalRemaining) / summary.totalCredit) * 100)
      )
    : 0;
  const lastScheduledPayment = [...payments]
    .reverse()
    .find((row) => row.paymentDate)?.paymentDate;
  const lastPayment = latest?.result.lastPaymentDateLabel || lastScheduledPayment || '-';
  const interestSaved = latest?.result.totalInterestSaved;
  return (
    <div className="dashboard">
      <div className="dashboard__headline">
        <div>
          <span className="page-kicker">Home</span>
          <h1>Your mortgage at a glance</h1>
        </div>
        <div className="dashboard__headline-actions">
          <button type="button" className="secondary-button" onClick={onOpenSchedule}>
            Upload new PDF
          </button>
          <button type="button" className="primary-button" onClick={onOpenPlanner}>
            New scenario <span aria-hidden="true">&rarr;</span>
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
                  <div>
                    <strong>{entry.result.type === 'amount' ? 'By amount' : 'By months'}</strong>
                    <span>{shortDate(entry.createdAt)}</span>
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
          <span className="active-schedule__date">{meta ? meta.parsedPages + ' pages scanned' : 'Upload a PDF to get started'}</span>
          <dl>
            <div><dt>Rows</dt><dd>{summary.totalRows}</dd></div>
            <div><dt>Installments</dt><dd>{summary.totalInstallments}</dd></div>
            <div><dt>Confidence</dt><dd>{meta ? Math.round((meta.creditColumn.confidence || 0) * 100) + '%' : '-'}</dd></div>
          </dl>
          <button type="button" className="text-button" onClick={onOpenSchedule}>Review schedule &rarr;</button>
        </section>
      </div>

      <section className="balance-card" aria-label="Mortgage progress">
        <div className="balance-card__topline">
          <div>
            <span>Principal remaining</span>
            <strong>{formatMoney(principalRemaining)}</strong>
            <p>of {formatMoney(summary.totalCredit)} original principal</p>
          </div>
          <div className="balance-card__percent">
            <span>Paid off</span>
            <strong>{paidPercent.toFixed(1)}%</strong>
          </div>
        </div>
        <div className="mortgage-progress">
          <span style={{ width: paidPercent + '%' }} />
        </div>
        <div className="balance-card__scale">
          <span>Installment 1</span>
          <span>now · {firstUnpaidInstallment ?? '-'}/{summary.totalInstallments || '-'}</span>
          <span>Installment {summary.totalInstallments || '-'}</span>
        </div>
      </section>

      <div className="metric-grid">
        <article className="metric-card">
          <span>Installments left</span>
          <strong>{installmentsLeft}</strong>
          <small>{latest?.result.remainingYearsLabel || 'Upload a schedule to begin'}</small>
        </article>
        <article className="metric-card">
          <span>First unpaid</span>
          <strong>{firstUnpaidInstallment ? '#' + firstUnpaidInstallment : '-'}</strong>
          <small>current starting point</small>
        </article>
        <article className="metric-card">
          <span>Last payment</span>
          <strong>{lastPayment}</strong>
          <small>{latest ? 'in latest scenario' : 'from active schedule'}</small>
        </article>
        <article className="metric-card metric-card--accent">
          <span>Interest saved</span>
          <strong>{interestSaved == null ? '-' : formatMoney(interestSaved)}</strong>
          <small>from latest plan</small>
        </article>
      </div>
    </div>
  );
};
