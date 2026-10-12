import { useEffect, useRef, useState } from 'react';
import { ExtractionMeta, LoanDetails } from '../types';
import { formatEditableMoney } from '../utils/number';
import { saveLoanDetails } from '../utils/loanDetailsEditor';
import { uploadedDate } from '../utils/overviewFormatting';

export const LoanDetailsDialog = ({ details, meta, onSave, onClose }: {
  details: LoanDetails; meta: ExtractionMeta | null; onSave: (details: LoanDetails) => void; onClose: () => void;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState(details.originalLoanAmount == null ? '' : formatEditableMoney(details.originalLoanAmount));
  const [month, setMonth] = useState(details.startMonth ?? '');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; prior?.focus(); };
  }, []);
  return <dialog ref={dialog} className="loan-dialog" aria-labelledby="loan-dialog-title" onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); try { onSave(saveLoanDetails(details, amount, month)); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save'); } }}>
      <header><h2 id="loan-dialog-title">Loan details</h2><button type="button" className="dialog-close" aria-label="Close loan details" onClick={onClose}>×</button></header>
      <p>Permanent loan information, kept when you update your bank schedule.</p>
      <label>Original loan amount (RON)<input autoFocus inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Enter original loan amount" /></label>
      {!details.originalLoanAmountConfirmed && details.originalLoanAmount != null ? <small>Legacy amount: review and save to confirm.</small> : null}
      <label>Loan start month / year<input type="month" min="1000-01" max="9999-12" value={month} onChange={event => setMonth(event.target.value)} /></label>
      {!details.startMonth && (details.legacy?.contractedPeriod || details.legacy?.contractedYear) ? <small>Legacy start period: {details.legacy.contractedPeriod ?? details.legacy.contractedYear}</small> : null}
      <dl className="loan-metadata"><div><dt>Current bank schedule</dt><dd>{meta?.sourceFileName ?? 'No schedule uploaded'}</dd></div><div><dt>Extracted</dt><dd>{uploadedDate(meta?.extractedAt)}</dd></div></dl>
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save loan details</button></footer>
    </form>
  </dialog>;
};
