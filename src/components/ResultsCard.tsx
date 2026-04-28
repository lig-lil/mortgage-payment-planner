import { StoredCalculationResult } from '../types';
import { formatMoney } from '../utils/number';
import { SectionCard } from './SectionCard';

interface ResultsCardProps {
  title: string;
  results: StoredCalculationResult[];
}

const describeCoveredInstallments = (installments: number[]): string =>
  installments.length ? installments.join(', ') : 'No installments covered';

export const ResultsCard = ({ title, results }: ResultsCardProps) => {
  const latest = results[0];

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
                <h3>{latest.result.monthsCovered} months covered</h3>
                <p>
                  Principal covered: <strong>{formatMoney(latest.result.totalCreditCovered)}</strong>
                </p>
                <p>
                  Remaining principal: <strong>{formatMoney(latest.result.remainingCredit)}</strong>
                </p>
                <p>
                  Unused amount: <strong>{formatMoney(latest.result.unusedAmount)}</strong>
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
            <p>Covered installments: {describeCoveredInstallments(latest.result.installmentNumbersCovered)}</p>
            <p>Remaining installments: {latest.result.remainingMonths}</p>
          </div>
        </div>
      )}
    </SectionCard>
  );
};
