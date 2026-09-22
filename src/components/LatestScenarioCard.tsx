import { StoredCalculationResult } from '../types';
import { formatMoney } from '../utils/number';

interface LatestScenarioCardProps {
  latest: StoredCalculationResult | undefined;
  principalRemaining: number | undefined;
  principalReduction: number | null;
  firstUnpaidInstallment: number | null;
  installmentsLeft: number;
  lastPayment: string;
  interestSaved: number | undefined;
  onOpenPlanner: () => void;
}

export const LatestScenarioCard = ({
  latest, principalRemaining, principalReduction, firstUnpaidInstallment,
  installmentsLeft, lastPayment, interestSaved, onOpenPlanner
}: LatestScenarioCardProps) => {
  const createdAt = latest?.createdAt ? new Date(latest.createdAt) : null;
  const timestamp = createdAt && !Number.isNaN(createdAt.getTime())
    ? createdAt.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
      })
    : null;

  return (
    <section className="balance-card latest-scenario-card" aria-label="Latest scenario">
      <header className="latest-scenario-card__header">
        <h2>LATEST SCENARIO</h2>
        {latest ? (
          <p>{latest.result.type === 'amount' ? 'By amount' : 'By months'}{timestamp ? ` · ${timestamp}` : ''}</p>
        ) : null}
      </header>
      {latest ? (
        <>
          <div className="latest-scenario-card__main">
            <span>Principal remaining</span>
            <strong>{principalRemaining == null ? '—' : formatMoney(principalRemaining)}</strong>
            {principalReduction != null ? (
              <p className={`latest-scenario-card__comparison${principalReduction > 0 ? ' latest-scenario-card__comparison--positive' : ''}`}>
                {principalReduction > 0 ? (
                  <><span aria-hidden="true">↓ </span><span className="latest-scenario-card__sr-only">Reduction of </span>{formatMoney(principalReduction)} vs current mortgage</>
                ) : principalReduction === 0 ? 'Unchanged vs current mortgage' : (
                  <>{formatMoney(Math.abs(principalReduction))} higher than current mortgage</>
                )}
              </p>
            ) : null}
          </div>
          <dl className="latest-scenario-card__metrics">
            <div className="latest-scenario-card__metric">
              <dt>First unpaid</dt>
              <dd>{firstUnpaidInstallment ? '#' + firstUnpaidInstallment : '—'}</dd>
            </div>
            <div className="latest-scenario-card__metric">
              <dt>Installments left</dt>
              <dd>{installmentsLeft}</dd>
              {latest.result.remainingYearsLabel ? <dd className="latest-scenario-card__helper">{latest.result.remainingYearsLabel}</dd> : null}
            </div>
            <div className="latest-scenario-card__metric">
              <dt>Last payment</dt>
              <dd>{lastPayment}</dd>
            </div>
            <div className="latest-scenario-card__metric">
              <dt>Interest saved</dt>
              <dd>{interestSaved == null ? '—' : formatMoney(interestSaved)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <div className="latest-scenario-card__empty">
          <strong>No active scenario</strong>
          <p>Create a repayment scenario to see how an extra payment could change your mortgage.</p>
        </div>
      )}
      {!latest ? <footer className="latest-scenario-card__footer">
        <button type="button" className="primary-button" onClick={onOpenPlanner}>
          New scenario <span aria-hidden="true">→</span>
        </button>
      </footer> : null}
    </section>
  );
};
