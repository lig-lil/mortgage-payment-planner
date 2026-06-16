import { FormEvent } from 'react';
import { PlanningCalculationResult, StoredCalculationResult } from '../types';
import { formatMoney } from '../utils/number';
import { SectionCard } from './SectionCard';

interface ResultsCardProps {
  title: string;
  results: StoredCalculationResult[];
  planningDraft: string;
  planningResult: PlanningCalculationResult | null;
  planningError: string | null;
  onPlanningDraftChange: (value: string) => void;
  onPlanningCalculate: () => void;
}

export const ResultsCard = ({
  title,
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
    <SectionCard title={title}>
      {!latest ? (
        <p className="empty-state">
          Run one of the calculations to see the latest locally saved result.
        </p>
      ) : (
        <div className="results-stack">
          <div className="result-highlight">
            {latest.result.type === 'amount' ? (
              <>
                <p>
                  Principal covered: <strong>{formatMoney(latest.result.totalCreditCovered)}</strong>
                </p>
                <p>
                  Remaining principal: <strong>{formatMoney(latest.result.remainingCredit)}</strong>
                </p>
              </>
            ) : (
              <>
                <h3>{latest.result.monthsRequested} months selected</h3>
                <p>
                  Required amount: <strong>{formatMoney(latest.result.totalAmountRequired)}</strong>
                </p>
                <p>
                  Remaining principal: <strong>{formatMoney(latest.result.remainingCredit)}</strong>
                </p>
              </>
            )}
            <p>Covered installments: {coveredInstallmentsLabel}</p>
            <p>Remaining installments: {remainingInstallments}</p>
            <p>Remaining years: {remainingYears}</p>
            <p>Last payment date: {lastPaymentDateLabel}</p>
            <p>
              Total interest saved:{' '}
              <strong>
                {latest.result.totalInterestSaved == null
                  ? '-'
                  : formatMoney(latest.result.totalInterestSaved)}
              </strong>
            </p>
          </div>
          <div className="planning-panel">
            <h3>Planning</h3>
            <form className="planning-form" onSubmit={handlePlanningSubmit}>
              <label className="field">
                <span>Monthly reimbursement</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 2000"
                  value={planningDraft}
                  onChange={(event) => onPlanningDraftChange(event.target.value)}
                />
              </label>
              <button type="submit" className="primary-button">
                Calculate
              </button>
            </form>
            {planningError ? <div className="inline-error">{planningError}</div> : null}
            <div className="planning-results">
              <p>
                Estimated remaining months:{' '}
                <strong>{planningResult?.estimatedRemainingMonths ?? '-'}</strong>
              </p>
              <p>
                Estimated remaining years:{' '}
                <strong>{planningResult?.estimatedRemainingYearsLabel ?? '-'}</strong>
              </p>
              <p>
                Estimated last payment date:{' '}
                <strong>{planningResult?.estimatedLastPaymentDateLabel || '-'}</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
};
