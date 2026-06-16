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
  const selectableRows = principalRows(rows)
    .map((row, index) => ({
      row,
      principalInstallmentNumber: index + 1
    }));

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
          disabled={!selectableRows.length}
        >
          {!selectableRows.length ? <option value="">No installments available</option> : null}
          {selectableRows.map(({ row, principalInstallmentNumber }) => (
            <option key={row.id} value={row.id}>
              Installment {principalInstallmentNumber}
            </option>
          ))}
        </select>
      </label>
    </SectionCard>
  );
};
