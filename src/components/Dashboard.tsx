import { FormEvent, useState } from 'react';
import { ExtractionMeta, ScheduleRow, StoredCalculationResult } from '../types';
import {
  formatEditableMoney,
  formatMoney,
  parseFlexibleNumber,
  parsePositiveInteger
} from '../utils/number';
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
  onOriginalPrincipalLockChange: (locked: boolean) => void;
  onContractedYearChange: (value: string) => void;
  onTotalInstallmentsChange: (value: number) => void;
  onTotalInstallmentsLockChange: (locked: boolean, value?: number) => void;
}

const EditIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 11.7 3.3 9.2 10.4 2.1l2.5 2.5-7.1 7.1-2.8.4Z" />
    <path d="M9.5 3 12 5.5" />
  </svg>
);

const LockIcon = ({ locked }: { locked: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <rect x="3.5" y="7" width="9" height="6" rx="1.2" />
    <path d={locked ? 'M5.5 7V5.3a2.5 2.5 0 0 1 5 0V7' : 'M5.5 7V5.3a2.5 2.5 0 0 1 4.4-1.6'} />
  </svg>
);

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
  onOriginalPrincipalChange,
  onOriginalPrincipalLockChange,
  onContractedYearChange,
  onTotalInstallmentsChange,
  onTotalInstallmentsLockChange
}: DashboardProps) => {
  const [isEditingOriginalPrincipal, setIsEditingOriginalPrincipal] = useState(false);
  const [originalPrincipalDraft, setOriginalPrincipalDraft] = useState('');
  const [isEditingTotalInstallments, setIsEditingTotalInstallments] = useState(false);
  const [totalInstallmentsDraft, setTotalInstallmentsDraft] = useState('');
  const summary = rowsSummary(rows);
  const payments = principalRows(rows);
  const latest = results[0];
  const isOriginalPrincipalLocked = Boolean(meta?.originalPrincipalLocked);
  const isTotalInstallmentsLocked = Boolean(meta?.totalInstallmentsLocked);
  const totalInstallments = meta?.totalInstallmentsOverride ?? summary.totalInstallments;
  const unpaidIndex = Math.max(0, (firstUnpaidInstallment ?? 1) - 1);
  const actualPrincipalRemaining = payments.reduce((total, row) => total + row.creditAmount, 0);
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

  const startEditingTotalInstallments = () => {
    setTotalInstallmentsDraft(String(totalInstallments || ''));
    setIsEditingTotalInstallments(true);
  };

  const saveOriginalPrincipal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = parseFlexibleNumber(originalPrincipalDraft);

    if (value == null || value <= 0) {
      return;
    }

    onOriginalPrincipalChange(value);
    onOriginalPrincipalLockChange(true);
    setIsEditingOriginalPrincipal(false);
  };

  const saveTotalInstallments = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = parsePositiveInteger(totalInstallmentsDraft);

    if (value == null || value <= 0) {
      return;
    }

    onTotalInstallmentsChange(value);
    onTotalInstallmentsLockChange(true, value);
    setIsEditingTotalInstallments(false);
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
          <div className="balance-card__principal-grid">
            <div>
              <span>Actual principal remaining</span>
              <strong>{formatMoney(actualPrincipalRemaining)}</strong>
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
                  {meta ? (
                    <>
                      <button type="button" onClick={startEditingOriginalPrincipal}>Edit</button>
                      <button
                        type="button"
                        className={isOriginalPrincipalLocked ? 'is-locked' : ''}
                        onClick={() => onOriginalPrincipalLockChange(!isOriginalPrincipalLocked)}
                      >
                        {isOriginalPrincipalLocked ? 'Unlock' : 'Lock'}
                      </button>
                    </>
                  ) : null}
                </div>
              )}
              <label className="contracted-year-field">
                <input
                  aria-label="Contracted year"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={meta?.contractedYear ?? ''}
                  onChange={(event) => onContractedYearChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <span>Contracted year</span>
              </label>
            </div>
            <div className="balance-card__scenario-principal">
              <span>Principal remaining after scenario</span>
              <strong>{scenarioPrincipalRemaining == null ? '-' : formatMoney(scenarioPrincipalRemaining)}</strong>
            </div>
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
          <span>now - {firstUnpaidInstallment ?? '-'}/{totalInstallments || '-'}</span>
          <span className="installment-progress-end">
            {isEditingTotalInstallments ? (
              <form className="installments-edit" onSubmit={saveTotalInstallments}>
                <span>Installment</span>
                <input
                  aria-label="Total installments"
                  type="text"
                  inputMode="numeric"
                  value={totalInstallmentsDraft}
                  onChange={(event) => setTotalInstallmentsDraft(event.target.value)}
                  autoFocus
                />
                <button type="submit" aria-label="Save total installments">Save</button>
                <button type="button" aria-label="Cancel total installments edit" onClick={() => setIsEditingTotalInstallments(false)}>Cancel</button>
              </form>
            ) : (
              <>
                Installment {totalInstallments || '-'}
                {meta ? (
                  <span className="installment-progress-actions">
                    <button type="button" aria-label="Edit total installments" onClick={startEditingTotalInstallments}>
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={isTotalInstallmentsLocked ? 'Unlock total installments' : 'Lock total installments'}
                      className={isTotalInstallmentsLocked ? 'is-locked' : ''}
                      onClick={() => onTotalInstallmentsLockChange(!isTotalInstallmentsLocked, totalInstallments)}
                    >
                      <LockIcon locked={isTotalInstallmentsLocked} />
                    </button>
                  </span>
                ) : null}
              </>
            )}
          </span>
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
