import { FormEvent, useState } from 'react';
import { ExtractionMeta } from '../types';
import { formatEditableMoney, formatMoney, parseFlexibleNumber } from '../utils/number';

interface CurrentMortgageCardProps {
  meta: ExtractionMeta | null;
  actualPrincipalRemaining: number;
  originalPrincipal: number;
  paidPercent: number;
  totalInstallments: number;
  onOpenSchedule: () => void;
  onOriginalPrincipalChange: (value: number) => void;
  onOriginalPrincipalLockChange: (locked: boolean) => void;
  onContractedPeriodChange: (value: string) => void;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

const EditIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 11.7 3.3 9.2 10.4 2.1l2.5 2.5-7.1 7.1-2.8.4Z" />
    <path d="M9.5 3 12 5.5" />
  </svg>
);

const LockIcon = ({ locked }: { locked: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <rect x="3.5" y="7" width="9" height="6" rx="1.2" />
    <path d={locked ? 'M5.5 7V5.3a2.5 2.5 0 0 1 5 0V7' : 'M5.5 7V5.3a2.5 2.5 0 0 1 4.4-1.6'} />
  </svg>
);

export const CurrentMortgageCard = ({
  meta, actualPrincipalRemaining, originalPrincipal, paidPercent, totalInstallments,
  onOpenSchedule, onOriginalPrincipalChange, onOriginalPrincipalLockChange, onContractedPeriodChange
}: CurrentMortgageCardProps) => {
  const [isEditingOriginalPrincipal, setIsEditingOriginalPrincipal] = useState(false);
  const [originalPrincipalDraft, setOriginalPrincipalDraft] = useState('');
  const isOriginalPrincipalLocked = Boolean(meta?.originalPrincipalLocked);
  const contractedPeriod = meta?.contractedPeriod ?? meta?.contractedYear ?? '';
  const contractedMonth = MONTHS.find((month) => contractedPeriod.startsWith(month)) ?? '';
  const contractedYear = contractedPeriod.match(/\d{1,4}$/)?.[0] ?? '';
  const uploadedAt = meta?.extractedAt ? new Date(meta.extractedAt) : null;
  const uploadedDate = uploadedAt && !Number.isNaN(uploadedAt.getTime())
    ? uploadedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const startEditingOriginalPrincipal = () => {
    if (isOriginalPrincipalLocked) {
      return;
    }

    setOriginalPrincipalDraft(formatEditableMoney(originalPrincipal));
    setIsEditingOriginalPrincipal(true);
  };

  const saveOriginalPrincipal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = parseFlexibleNumber(originalPrincipalDraft);

    if (value == null || value <= 0) {
      return;
    }

    onOriginalPrincipalChange(value);
    onOriginalPrincipalLockChange(true);
    setIsEditingOriginalPrincipal(false);
  };

  const updateContractedPeriod = (month: string, year: string) => {
    onContractedPeriodChange([month, year].filter(Boolean).join(' '));
  };

  return (
      <section className="balance-card current-mortgage" aria-label="Current mortgage">
        <header className="current-mortgage__header">
          <h2>CURRENT MORTGAGE</h2>
          <p>from active PDF</p>
        </header>
        <div className="balance-card__topline">
          <div className="balance-card__principal-grid">
            <div>
              <span>Actual principal remaining</span>
              <strong>{formatMoney(actualPrincipalRemaining)}</strong>
              {isEditingOriginalPrincipal ? (
                <form className="original-principal-edit" onSubmit={saveOriginalPrincipal}>
                  <span>of</span>
                  <input
                    aria-label="Original principal"
                    type="text"
                    inputMode="decimal"
                    value={originalPrincipalDraft}
                    onChange={(event) => setOriginalPrincipalDraft(event.target.value)}
                    autoFocus
                  />
                  <span>original principal</span>
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setIsEditingOriginalPrincipal(false)}>Cancel</button>
                </form>
              ) : (
                <div className="original-principal-line">
                  <p>of {formatMoney(originalPrincipal)} original principal</p>
                  {meta ? (
                    <span className="original-principal-actions">
                      <button
                        type="button"
                        aria-label={isOriginalPrincipalLocked ? 'Unlock original principal to edit' : 'Edit original principal'}
                        title={isOriginalPrincipalLocked ? 'Unlock original principal to edit' : 'Edit original principal'}
                        disabled={isOriginalPrincipalLocked}
                        onClick={startEditingOriginalPrincipal}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        aria-label={isOriginalPrincipalLocked ? 'Unlock original principal' : 'Lock original principal'}
                        title={isOriginalPrincipalLocked ? 'Unlock original principal' : 'Lock original principal'}
                        className={isOriginalPrincipalLocked ? 'is-locked' : ''}
                        onClick={() => onOriginalPrincipalLockChange(!isOriginalPrincipalLocked)}
                      >
                        <LockIcon locked={isOriginalPrincipalLocked} />
                      </button>
                    </span>
                  ) : null}
                </div>
              )}

            </div>
          </div>
          <div className="balance-card__percent">
            <span>Paid off</span>
            <strong>{paidPercent.toFixed(1)}%</strong>
          </div>
        </div>
        <div className="current-mortgage__details">
              <div className="contracted-period-field" role="group" aria-label="Contracted period">
                <span>Contracted period</span>
                <div className="contracted-period-field__inputs">
                  <select
                    aria-label="Contracted month"
                    value={contractedMonth}
                    onChange={(event) => updateContractedPeriod(event.target.value, contractedYear)}
                  >
                    <option value="" disabled hidden>Mon</option>
                    {MONTHS.map((month) => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                  <input
                    aria-label="Contracted year"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Year"
                    value={contractedYear}
                    onChange={(event) =>
                      updateContractedPeriod(
                        contractedMonth,
                        event.target.value.replace(/\D/g, '').slice(0, 4)
                      )
                    }
                  />
                </div>
              </div>
          <div className="current-mortgage__installments">
            <span>Total installments</span>
            <strong>{totalInstallments}</strong>
          </div>
        </div>
        <div className="mortgage-progress" role="progressbar" aria-label="Mortgage paid off" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercent}>
          <span style={{ width: paidPercent + '%' }} />
        </div>
        <footer className="current-mortgage__footer">
          <div className="current-mortgage__source">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" />
              <path d="M14 3v5h5M8 12h8M8 16h6" />
            </svg>
            <div>
              <strong>{meta?.sourceFileName || 'No active PDF'}</strong>
              <span>{meta?.sourceFileName ? (uploadedDate ? 'Uploaded ' + uploadedDate : 'Upload date unavailable') : 'Upload a PDF to get started'}</span>
            </div>
          </div>
          <button type="button" className="secondary-button" onClick={onOpenSchedule}>View details</button>
        </footer>
      </section>
  );
};
