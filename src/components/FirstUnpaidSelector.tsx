import { ScheduleRow } from '../types';
import { principalRows } from '../utils/rows';

interface FirstUnpaidSelectorProps {
  rows: ScheduleRow[];
  value: string | null;
  onChange: (value: string) => void;
}

export const FirstUnpaidSelector = ({
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
    <section className="planner-start-card">
      <div className="planner-start-card__copy">
        <span className="planner-label">Starting from</span>
        <p><strong>First unpaid installment</strong><span>— calculations proceed in ascending order</span></p>
      </div>
      <label className="planner-start-card__select">
        <span>Installment</span>
        <select
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          disabled={!selectableRows.length}
        >
          {!selectableRows.length ? <option value="">No installments available</option> : null}
          {selectableRows.map(({ row, principalInstallmentNumber }) => (
            <option key={row.id} value={row.id}>
              #{principalInstallmentNumber}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
};
