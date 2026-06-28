import { FormEvent, useState } from 'react';
import { ExtractionMeta, ScheduleRow, StoredCalculationResult } from '../types';
import { formatEditableMoney, formatMoney, parseFlexibleNumber } from '../utils/number';
import { principalRows, rowsSummary } from '../utils/rows';
import { formatScheduleDate } from '../utils/scheduleDate';

interface DashboardProps {
  rows: ScheduleRow[];
  firstUnpaidInstallment: number | null;
  meta: ExtractionMeta | null;
  results: StoredCalculationResult[];
  onOpenPlanner: () => void;
  onOpenSchedule: () => void;
  onOpenHistory: () => void;
  onOriginalPrincipalChange: (value: number) => void;
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
  onOpenHistory,
  onOriginalPrincipalChange
}: DashboardProps) => {
  const [isEditingOriginalPrincipal, setIsEditingOriginalPrincipal] = useState(false);
  const [originalPrincipalDraft, setOriginalPrincipalDraft] = useState('');
  const summary = rowsSummary(rows);
  const payments = principalRows(rows);
  const latest = results[0];
  const unpaidIndex = Math.max(0, (firstUnpaidInstallment ?? 1) - 1);
  const scheduledRemaining = payments
    .slice(unpaidIndex)
    .reduce((total, row) => total + row.creditAmount, 0);
  const principalRemaining = latest?.result.remainingCredit ?? scheduledRemaining;
  const originalPrincipal = meta?.originalPrincipal ?? summary.totalCredit;
  const installmentsLeft =
    latest?.result.remainingMonths ?? Math.max(0, payments.length - unpaidIndex);
  const paidPercent = originalPrincipal
    ? Math.min(
        100,
        Math.max(0, ((originalPrincipal - principalRemaining) / originalPrincipal) * 100)
      )
    : 0;
  const lastScheduledPayment = [...payments]
    .reverse()
    .find((row) => row.paymentDate)?.paymentDate;
  const lastPayment =
    latest?.result.lastPaymentDateLabel ||
    (lastScheduledPayment ? formatScheduleDate(lastScheduledPayment) : '-');
  const interestSaved = latest?.result.totalInterestSaved;

  const startEditingOriginalPrincipal = () => {
    setOriginalPrincipalDraft(formatEditableMoney(originalPrincipal));
    setIsEditingOriginalPrincipal(true);
  };

  const saveOriginalPrincipal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = parseFlexibleNumber(originalPrincipalDraft);

    if (value == null || value <= 0) {
      return;
    }

    onOriginalPrincipalChange(value);
    setIsEditingOriginalPrincipal(false);
  };

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
            {isEditingOriginalPrincipal ? (
              <form className="original-principal-edit" onSubmit={saveOriginalPrincipal}>
                <span>of</span>
                <input
                  aria-label="Original principal"
                  type="text"
                  inputMode="decimal"
                  value={originalPrincipalDraft}
                  onChange={(event) => setOriginalPrincipalDraft(event.target.value)}
                  autoFocus
                />
                <span>original principal</span>
                <button type="submit">Save</button>
                <button type="button" onClick={() => setIsEditingOriginalPrincipal(false)}>Cancel</button>
              </form>
            ) : (
              <div className="original-principal-line">
                <p>of {formatMoney(originalPrincipal)} original principal</p>
                {meta ? <button type="button" onClick={startEditingOriginalPrincipal}>Edit</button> : null}
              </div>
            )}
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
