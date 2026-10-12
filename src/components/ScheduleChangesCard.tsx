import { ScheduleComparison } from '../types';
import { formatMoney } from '../utils/number';
import { formatScheduleDate } from '../utils/scheduleDate';

const moneyChange = (delta: number) => delta === 0 ? 'No change' :
  `${delta < 0 ? '↓' : '↑'} ${formatMoney(Math.abs(delta))}`;

const termChange = (comparison: ScheduleComparison): string => {
  const months = comparison.termDifferenceMonths;
  if (months == null) return 'Not available for both schedules';
  if (months === 0) {
    if (comparison.previous.finalPaymentDate === comparison.current.finalPaymentDate) return 'No change';
    return `Less than 1 month ${comparison.current.finalPaymentDate! < comparison.previous.finalPaymentDate! ? 'earlier' : 'later'}`;
  }
  return `${Math.abs(months)} ${Math.abs(months) === 1 ? 'month' : 'months'} ${months < 0 ? 'earlier' : 'later'}`;
};

export const ScheduleChangesCard = ({ comparison }: { comparison: ScheduleComparison | null }) => (
  <section className="dashboard-panel schedule-changes" aria-labelledby="schedule-changes-title">
    <header className="latest-scenario-card__header">
      <h2 id="schedule-changes-title">CHANGES SINCE PREVIOUS SCHEDULE</h2>
      <p>What changed after your latest updated schedule.</p>
    </header>
    {!comparison ? (
      <div className="schedule-changes__empty">
        <strong>No previous schedule to compare yet.</strong>
        <p>Upload an updated mortgage schedule later to see how your mortgage has changed.</p>
      </div>
    ) : (
      <>
        <p className="schedule-changes__sources" title={`${comparison.previous.sourceFileName} → ${comparison.current.sourceFileName}`}>
          Previous real PDF schedule → Current real PDF schedule
        </p>
        <dl className="schedule-changes__metrics">
          <div>
            <dt>Principal remaining</dt>
            <dd>{formatMoney(comparison.previous.principalRemaining)} → {formatMoney(comparison.current.principalRemaining)}</dd>
            <dd className={`schedule-changes__delta${comparison.principalDelta < 0 ? ' latest-scenario-card__comparison--positive' : ''}`}>{moneyChange(comparison.principalDelta)}</dd>
          </div>
          <div>
            <dt>Installments remaining</dt>
            <dd>{comparison.installmentsDelta == null ? '—' : `${comparison.previous.installmentsRemaining} → ${comparison.current.installmentsRemaining}`}</dd>
            <dd className={`schedule-changes__delta${comparison.installmentsDelta != null && comparison.installmentsDelta < 0 ? ' latest-scenario-card__comparison--positive' : ''}`}>
              {comparison.installmentsDelta == null ? 'Not available for both schedules' : comparison.installmentsDelta === 0 ? 'No change' : `${comparison.installmentsDelta < 0 ? '\u2193' : '\u2191'} ${Math.abs(comparison.installmentsDelta)} ${Math.abs(comparison.installmentsDelta) === 1 ? 'installment' : 'installments'}`}
            </dd>
          </div>
          <div>
            <dt>Mortgage term</dt>
            <dd>{comparison.termDifferenceMonths == null ? '—' : `${formatScheduleDate(comparison.previous.finalPaymentDate!)} → ${formatScheduleDate(comparison.current.finalPaymentDate!)}`}</dd>
            <dd className={`schedule-changes__delta${comparison.termDifferenceMonths != null && comparison.termDifferenceMonths < 0 ? ' latest-scenario-card__comparison--positive' : ''}`}>{termChange(comparison)}</dd>
          </div>
        </dl>
      </>
    )}
  </section>
);
