import { useEffect, useMemo, useState } from 'react';
import { ScheduleRow } from '../types';
import { formatEditableMoney, parseFlexibleNumber, parsePositiveInteger } from '../utils/number';
import { SectionCard } from './SectionCard';

interface ScheduleEditorProps {
  title: string;
  rows: ScheduleRow[];
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
  onUpdateRow: (rowId: string, changes: Partial<ScheduleRow>) => void;
  onSortRows: () => void;
}

interface DraftMap {
  [rowId: string]: {
    installmentNumber: string;
    creditAmount: string;
    interestAmount: string;
  };
}

export const ScheduleEditor = ({
  title,
  rows,
  onAddRow,
  onDeleteRow,
  onUpdateRow,
  onSortRows
}: ScheduleEditorProps) => {
  const rowsSignature = useMemo(
    () =>
      rows
        .map((row) => `${row.id}:${row.installmentNumber}:${row.creditAmount}:${row.interestAmount ?? ''}`)
        .join('|'),
    [rows]
  );

  const [drafts, setDrafts] = useState<DraftMap>({});

  useEffect(() => {
    const nextDrafts = rows.reduce<DraftMap>((accumulator, row) => {
      accumulator[row.id] = {
        installmentNumber: String(row.installmentNumber).padStart(3, '0'),
        creditAmount: formatEditableMoney(row.creditAmount),
        interestAmount: row.interestAmount == null ? '' : formatEditableMoney(row.interestAmount)
      };
      return accumulator;
    }, {});

    setDrafts(nextDrafts);
  }, [rowsSignature, rows]);

  const updateDraft = (rowId: string, field: keyof DraftMap[string], value: string) => {
    setDrafts((current) => ({
      ...current,
      [rowId]: {
        ...current[rowId],
        [field]: value
      }
    }));
  };

  const commitDraft = (rowId: string) => {
    const draft = drafts[rowId];
    if (!draft) {
      return;
    }

    const installmentNumber = parsePositiveInteger(draft.installmentNumber);
    const creditAmount = parseFlexibleNumber(draft.creditAmount);
    const interestAmount = parseFlexibleNumber(draft.interestAmount);

    if (installmentNumber != null) {
      onUpdateRow(rowId, { installmentNumber });
    }

    if (creditAmount != null && creditAmount >= 0) {
      onUpdateRow(rowId, { creditAmount });
    }

    if (!draft.interestAmount.trim()) {
      onUpdateRow(rowId, { interestAmount: undefined });
    } else if (interestAmount != null && interestAmount >= 0) {
      onUpdateRow(rowId, { interestAmount });
    }
  };

  return (
    <SectionCard
      title={title}
      description="Click any value to edit. Changes save instantly."
      actions={
        <div className="inline-actions">
          <button type="button" className="secondary-button" onClick={onSortRows}>
            Sort by #
          </button>
          <button type="button" className="primary-button" onClick={onAddRow}>
            + Add row
          </button>
        </div>
      }
    >
      <div className="table-wrapper">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Principal</th>
              <th>Interest</th>
              <th><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  No rows available yet. You can add a new schedule manually.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="installment-cell">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Installment ${row.installmentNumber}`}
                        value={drafts[row.id]?.installmentNumber ?? String(row.installmentNumber).padStart(3, '0')}
                        onChange={(event) => updateDraft(row.id, 'installmentNumber', event.target.value)}
                        onBlur={() => commitDraft(row.id)}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="money-cell">
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Principal for installment ${row.installmentNumber}`}
                        value={drafts[row.id]?.creditAmount ?? formatEditableMoney(row.creditAmount)}
                        onChange={(event) => updateDraft(row.id, 'creditAmount', event.target.value)}
                        onBlur={() => commitDraft(row.id)}
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Interest for installment ${row.installmentNumber}`}
                      placeholder="–"
                      value={drafts[row.id]?.interestAmount ?? (row.interestAmount == null ? '' : formatEditableMoney(row.interestAmount))}
                      onChange={(event) => updateDraft(row.id, 'interestAmount', event.target.value)}
                      onBlur={() => commitDraft(row.id)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => onDeleteRow(row.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};
