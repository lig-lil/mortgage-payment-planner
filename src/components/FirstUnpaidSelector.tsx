import { ScheduleRow } from '../types';
import { sortRows } from '../utils/rows';
import { SectionCard } from './SectionCard';

interface FirstUnpaidSelectorProps {
  title: string;
  rows: ScheduleRow[];
  value: number | null;
  onChange: (value: number) => void;
}

export const FirstUnpaidSelector = ({
  title,
  rows,
  value,
  onChange
}: FirstUnpaidSelectorProps) => {
  const sortedRows = sortRows(rows);

  return (
    <SectionCard
      title={title}
      description="Calculations start from this installment and continue in ascending order."
    >
      <label className="field">
        <span>Starting installment</span>
        <select
          value={value ?? ''}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={!sortedRows.length}
        >
          {!sortedRows.length ? <option value="">No installments available</option> : null}
          {sortedRows.map((row) => (
            <option key={row.id} value={row.installmentNumber}>
              Installment {row.installmentNumber}
            </option>
          ))}
        </select>
      </label>
    </SectionCard>
  );
};
