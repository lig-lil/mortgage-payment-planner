import { ExtractionMeta, ScheduleRow } from '../types';
import { formatMoney } from '../utils/number';
import { rowsSummary } from '../utils/rows';
import { SectionCard } from './SectionCard';

interface SummaryCardProps {
  title: string;
  rows: ScheduleRow[];
  firstUnpaidInstallment: number | null;
  meta: ExtractionMeta | null;
}

export const SummaryCard = ({
  title,
  rows,
  firstUnpaidInstallment,
  meta
}: SummaryCardProps) => {
  const summary = rowsSummary(rows);

  return (
    <SectionCard title={title}>
      <div className="summary-grid">
        <div className="summary-stat">
          <span>Total rows</span>
          <strong>{summary.totalRows}</strong>
        </div>
        <div className="summary-stat">
          <span>Installments</span>
          <strong>{summary.totalInstallments}</strong>
        </div>
        <div className="summary-stat">
          <span>First unpaid</span>
          <strong>{firstUnpaidInstallment ? `#${firstUnpaidInstallment}` : '-'}</strong>
        </div>
        <div className="summary-stat">
          <span>Principal total</span>
          <strong>{formatMoney(summary.totalCredit)}</strong>
        </div>
        <div className="summary-stat">
          <span>Range</span>
          <strong>
            {summary.firstInstallment ?? '-'}
            {summary.lastInstallment ? <> &rarr; {summary.lastInstallment}</> : null}
          </strong>
        </div>
        <div className="summary-stat summary-stat--confidence">
          <span>Confidence</span>
          <strong>{meta ? `${Math.round((meta.creditColumn.confidence || 0) * 100)}%` : '-'}</strong>
        </div>
      </div>
    </SectionCard>
  );
};
