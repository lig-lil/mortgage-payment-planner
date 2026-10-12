import { ActualMortgageState, LoanDetails } from '../types';
import { ron, scheduledDate, uploadedDate } from '../utils/overviewFormatting';

export const CurrentMortgageCard = ({ actual, details, onLoanDetails, onOpenSchedule }: {
  actual: ActualMortgageState; details: LoanDetails; onLoanDetails: () => void; onOpenSchedule: () => void;
}) => {
  const progress = actual.principalRepaid;
  const split = actual.nextInstallmentAmount != null && actual.nextInstallmentAmount > 0 && actual.nextPrincipal != null
    ? actual.nextPrincipal / actual.nextInstallmentAmount * 100 : null;
  return <section className="overview-card mortgage-actual" aria-labelledby="current-mortgage-title">
    <header className="overview-card-heading"><h2 id="current-mortgage-title">Current mortgage</h2><div className="heading-actions"><span className="data-chip">Actual · bank schedule</span><button className="compact-action" aria-haspopup="dialog" onClick={onLoanDetails}>Loan details</button></div></header>
    <div className="mortgage-primary-grid">
      <div className="mortgage-balance"><span className="metric-label">Outstanding principal</span><strong className="mortgage-balance-number">{ron(actual.outstandingPrincipal)}</strong>
        {progress.percentage != null ? <div className="principal-progress"><div><span>Principal repaid</span><strong>{progress.percentage.toFixed(1)}%</strong></div><div className="progress-track" role="progressbar" aria-label="Principal repaid" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}><span style={{ width: `${progress.percentage}%` }} /></div><small>{ron(progress.amount)} of {ron(details.originalLoanAmount)}</small></div>
        : <div className="loan-details-prompt"><strong>Repayment progress</strong><span>{progress.reason ?? 'Add the original loan amount to calculate principal repaid.'}</span><button className="text-button" onClick={onLoanDetails}>{details.originalLoanAmountConfirmed ? 'Review loan details' : 'Add loan details'} ›</button></div>}
      </div>
      <div className="mortgage-next"><div className="next-topline"><span>Next installment · {scheduledDate(actual.nextInstallmentDate)}</span><strong>{ron(actual.nextInstallmentAmount)}</strong></div>
        {split != null ? <div className="payment-split" aria-hidden="true"><span style={{ width: `${split}%` }} /><span /></div> : null}
        <div className="payment-components"><span><i />Principal <strong>{ron(actual.nextPrincipal)}</strong></span><span><i />Interest <strong>{ron(actual.nextInterest)}</strong></span></div>
        {actual.firstUnpaidInstallment ? <small>Actual first unpaid · installment #{actual.firstUnpaidInstallment.installmentNumber}</small> : <small>Upload a bank schedule to see your next payment.</small>}
      </div>
    </div>
    <dl className="actual-metrics"><div><dt>Installments left</dt><dd>{actual.installmentsRemaining ?? '—'}</dd></div><div><dt>Remaining interest</dt><dd>{ron(actual.remainingInterest)}</dd></div><div><dt>Last payment date</dt><dd>{scheduledDate(actual.lastScheduledPaymentDate)}</dd></div></dl>
    <footer className="mortgage-source"><div><span>Current bank schedule</span><strong>{actual.sourceFileName ?? 'No schedule uploaded'}</strong><small>{actual.extractedAt ? `Extracted ${uploadedDate(actual.extractedAt)}` : 'Upload your repayment schedule to get started.'}</small></div><button className="text-button" onClick={onOpenSchedule}>{actual.sourceFileName ? 'View schedule' : 'Upload schedule'}</button></footer>
  </section>;
};
