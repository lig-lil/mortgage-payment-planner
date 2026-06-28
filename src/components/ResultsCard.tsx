import { FormEvent } from 'react';
import { PlanningCalculationResult, StoredCalculationResult } from '../types';
import { formatMoney } from '../utils/number';

interface ResultsCardProps {
  results: StoredCalculationResult[];
  planningDraft: string;
  planningResult: PlanningCalculationResult | null;
  planningError: string | null;
  onPlanningDraftChange: (value: string) => void;
  onPlanningCalculate: () => void;
}

export const ResultsCard = ({
  results,
  planningDraft,
  planningResult,
  planningError,
  onPlanningDraftChange,
  onPlanningCalculate
}: ResultsCardProps) => {
  const latest = results[0];
  const coveredInstallments =
    latest?.result.monthsCovered ?? latest?.result.installmentNumbersCovered.length ?? 0;
  const coveredInstallmentsLabel = `${coveredInstallments} ${
    coveredInstallments === 1 ? 'month' : 'months'
  }`;
  const remainingInstallments = latest?.result.remainingMonths ?? 0;
  const remainingYears = latest?.result.remainingYearsLabel ?? null;
  const lastPaymentDateLabel = latest?.result.lastPaymentDateLabel ?? '';
  const handlePlanningSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onPlanningCalculate();
  };

  return (
    <section className="planner-outcome">
      <h2>Outcome</h2>
      {!latest ? (
        <p className="empty-state">Run one of the calculations to see the latest locally saved result.</p>
      ) : (
        <div className="results-stack">
          <div className="outcome-highlights">
            <div>
              <span>{latest.result.type === 'amount' ? 'Principal covered' : 'Required amount'}</span>
              <strong>{formatMoney(latest.result.type === 'amount' ? latest.result.totalCreditCovered : latest.result.totalAmountRequired)}</strong>
            </div>
            <div><span>Remaining</span><strong>{formatMoney(latest.result.remainingCredit)}</strong></div>
          </div>
          <dl className="outcome-list">
            <div><dt>Covered installments</dt><dd>{coveredInstallmentsLabel}</dd></div>
            <div><dt>Remaining installments</dt><dd>{remainingInstallments}</dd></div>
            <div><dt>Remaining years</dt><dd>{remainingYears}</dd></div>
            <div><dt>Last payment date</dt><dd>{lastPaymentDateLabel}</dd></div>
            <div className={latest.result.totalInterestSaved != null && latest.result.totalInterestSaved < 0 ? 'outcome-list__interest' : undefined}><dt>Interest saved</dt><dd>{latest.result.totalInterestSaved == null ? '-' : formatMoney(latest.result.totalInterestSaved)}</dd></div>
          </dl>
          <div className="planner-extra">
            <span className="planner-label">What if I pay extra each month</span>
            <form className="planning-form" onSubmit={handlePlanningSubmit}>
              <label className="calculation-input">
                <span>RON/mo</span>
                <input type="text" inputMode="decimal" placeholder="2,000" value={planningDraft} onChange={(event) => onPlanningDraftChange(event.target.value)} />
              </label>
              <button type="submit" className="secondary-button">Calculate</button>
            </form>
            {planningError ? <div className="inline-error">{planningError}</div> : null}
            <div className="planning-results">
              <p><span>Months</span><strong>{planningResult?.estimatedRemainingMonths ?? '-'}</strong></p>
              <p><span>Years</span><strong>{planningResult?.estimatedRemainingYearsLabel ?? '-'}</strong></p>
              <p><span>Last payment</span><strong>{planningResult?.estimatedLastPaymentDateLabel || '-'}</strong></p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
