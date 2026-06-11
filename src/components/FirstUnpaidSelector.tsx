import { ScheduleRow } from '../types';
import { principalRows } from '../utils/rows';
import { SectionCard } from './SectionCard';

interface FirstUnpaidSelectorProps {
  title: string;
  rows: ScheduleRow[];
  value: string | null;
  onChange: (value: string) => void;
}

export const FirstUnpaidSelector = ({
  title,
  rows,
  value,
  onChange
}: FirstUnpaidSelectorProps) => {
  const sortedRows = principalRows(rows).slice(1);

  return (
    <SectionCard
      title={title}
      description="Calculations start from this installment and continue in ascending order."
    >
      <label className="field">
        <span>Starting installment</span>
        <select
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          disabled={!sortedRows.length}
        >
          {!sortedRows.length ? <option value="">No installments available</option> : null}
          {sortedRows.map((row) => (
            <option key={row.id} value={row.id}>
              Installment {row.installmentNumber}
            </option>
          ))}
        </select>
      </label>
    </SectionCard>
  );
};
