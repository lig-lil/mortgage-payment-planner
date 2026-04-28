import { StoredCalculationResult } from '../types';
import { formatMoney } from '../utils/number';
import { SectionCard } from './SectionCard';

interface HistoryCardProps {
  title: string;
  results: StoredCalculationResult[];
}

export const HistoryCard = ({ title, results }: HistoryCardProps) => {
  const historyEntries = results.slice(1, 6);

  if (!historyEntries.length) {
    return null;
  }

  return (
    <SectionCard title={title}>
      <div className="history-list">
        {historyEntries.map((entry) => (
          <div key={entry.id} className="history-item">
            <div>
              <strong>{entry.result.type === 'amount' ? 'By amount' : 'By months'}</strong>
              <span>
                {new Date(entry.createdAt).toLocaleString('en-US', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })}
              </span>
            </div>
            <div>
              {entry.result.type === 'amount'
                ? `${entry.result.monthsCovered} months / ${formatMoney(
                    entry.result.totalCreditCovered
                  )}`
                : `${entry.result.monthsRequested} months / ${formatMoney(
                    entry.result.totalAmountRequired
                  )}`}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};
