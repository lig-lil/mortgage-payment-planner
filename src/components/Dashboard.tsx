import { ActualMortgageState, ExtractionMeta, LoanDetails, ScheduleComparison, StoredCalculationResult } from '../types';
import { CurrentMortgageCard } from './CurrentMortgageCard';
import { ScheduleChangesCard } from './ScheduleChangesCard';
import { LatestScenarioCard } from './LatestScenarioCard';
import { LoanDetailsDialog } from './LoanDetailsDialog';
import { useState } from 'react';

export const Dashboard = ({ actualMortgage, loanDetails, scheduleComparison, meta, results, onOpenPlanner, onOpenSchedule, onSaveLoanDetails }: {
  actualMortgage: ActualMortgageState; loanDetails: LoanDetails; scheduleComparison: ScheduleComparison | null; meta: ExtractionMeta | null;
  results: StoredCalculationResult[]; onOpenPlanner: () => void; onOpenSchedule: () => void; onSaveLoanDetails: (details: LoanDetails) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const latest = results.reduce<StoredCalculationResult | undefined>((latest, entry) => !latest || entry.createdAt > latest.createdAt ? entry : latest, undefined);
  return <div className="overview"><header className="overview-page-heading"><h1>Overview</h1><p>Your mortgage, from the bank schedule to your next plan.</p></header><div className="overview-grid">
    <CurrentMortgageCard actual={actualMortgage} details={loanDetails} onLoanDetails={() => setEditing(true)} onOpenSchedule={onOpenSchedule} />
    <ScheduleChangesCard comparison={scheduleComparison} />
    <LatestScenarioCard latest={latest} onOpenPlanner={onOpenPlanner} />
  </div>{editing ? <LoanDetailsDialog details={loanDetails} meta={meta} onSave={onSaveLoanDetails} onClose={() => setEditing(false)} /> : null}</div>;
};
