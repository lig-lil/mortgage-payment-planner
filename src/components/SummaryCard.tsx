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
          <span>Total installments</span>
          <strong>{summary.totalInstallments}</strong>
        </div>
        <div className="summary-stat">
          <span>Total principal</span>
          <strong>{formatMoney(summary.totalCredit)}</strong>
        </div>
        <div className="summary-stat">
          <span>First unpaid installment</span>
          <strong>{firstUnpaidInstallment ?? '-'}</strong>
        </div>
        <div className="summary-stat">
          <span>Installment range</span>
          <strong>
            {summary.firstInstallment ?? '-'}
            {summary.lastInstallment ? ` -> ${summary.lastInstallment}` : ''}
          </strong>
        </div>
      </div>
      {meta ? (
        <div className="meta-strip">
          <span>File: {meta.sourceFileName}</span>
          <span>Pages scanned: {meta.parsedPages}</span>
          <span>
            Principal column confidence: {Math.round((meta.creditColumn.confidence || 0) * 100)}%
          </span>
        </div>
      ) : null}
    </SectionCard>
  );
};
