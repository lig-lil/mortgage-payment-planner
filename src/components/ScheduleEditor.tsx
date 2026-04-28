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
        .map((row) => `${row.id}:${row.installmentNumber}:${row.creditAmount}`)
        .join('|'),
    [rows]
  );

  const [drafts, setDrafts] = useState<DraftMap>({});

  useEffect(() => {
    const nextDrafts = rows.reduce<DraftMap>((accumulator, row) => {
      accumulator[row.id] = {
        installmentNumber: String(row.installmentNumber),
        creditAmount: formatEditableMoney(row.creditAmount)
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

    if (installmentNumber != null) {
      onUpdateRow(rowId, { installmentNumber });
    }

    if (creditAmount != null && creditAmount >= 0) {
      onUpdateRow(rowId, { creditAmount });
    }
  };

  return (
    <SectionCard
      title={title}
      description={`Extracted rows: ${rows.length}. You can edit the values directly and then run calculations.`}
      actions={
        <div className="inline-actions">
          <button type="button" className="secondary-button" onClick={onSortRows}>
            Sort by installment
          </button>
          <button type="button" className="primary-button" onClick={onAddRow}>
            Add row
          </button>
        </div>
      }
    >
      <div className="table-wrapper">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>Installment</th>
              <th>Principal</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  No rows available yet. You can add a new schedule manually.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={drafts[row.id]?.installmentNumber ?? String(row.installmentNumber)}
                      onChange={(event) =>
                        updateDraft(row.id, 'installmentNumber', event.target.value)
                      }
                      onBlur={() => commitDraft(row.id)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={drafts[row.id]?.creditAmount ?? formatEditableMoney(row.creditAmount)}
                      onChange={(event) =>
                        updateDraft(row.id, 'creditAmount', event.target.value)
                      }
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
