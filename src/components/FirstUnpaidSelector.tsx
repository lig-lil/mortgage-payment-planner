import { ScheduleRow } from '../types';
import { principalRows } from '../utils/rows';

interface FirstUnpaidSelectorProps {
  actual?: boolean;
  rows: ScheduleRow[];
  value: string | null;
  onChange: (value: string) => void;
}

export const FirstUnpaidSelector = ({
  actual = false,
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
        <span className="planner-label">{actual ? 'Actual mortgage' : 'Starting from'}</span>
        <p><strong>{actual ? 'Actual first unpaid installment' : 'Scenario starting installment'}</strong><span>— {actual ? ' correct the bank schedule payment status here' : ' extra principal begins at your selection'}</span></p>
      </div>
      <label className="planner-start-card__select">
        <span>Installment</span>
        <select
          aria-label={actual ? 'Actual first unpaid installment' : 'Scenario starting installment'}
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
