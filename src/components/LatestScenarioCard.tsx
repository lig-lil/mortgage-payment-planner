import { StoredCalculationResult } from '../types';
import { scenarioReferenceLabel } from '../utils/scenarios';
import { ron, uploadedDate } from '../utils/overviewFormatting';

export const LatestScenarioCard = ({ latest, onOpenPlanner }: { latest: StoredCalculationResult | undefined; onOpenPlanner: () => void }) => <section className="overview-card scenario-preview" aria-labelledby="latest-scenario-title">
  <header className="overview-card-heading"><h2 id="latest-scenario-title">Latest scenario</h2><span className="data-chip simulated-chip">Simulated</span></header>
  {latest ? <><div className="scenario-preview-title"><strong>{latest.scenarioType === 'interest' ? 'Interest comparison' : latest.result.type === 'amount' ? 'Prepayment by amount' : 'Cover installments'}</strong><span>{uploadedDate(latest.createdAt)}</span></div>
    <dl className="compact-metrics"><div><dt>Extra payment</dt><dd>{ron(latest.result.type === 'amount' ? latest.inputValue : latest.result.totalAmountRequired)}</dd></div><div><dt>Estimated term reduction</dt><dd>{Number.isFinite(latest.result.monthsCovered) ? `${latest.result.monthsCovered} months` : '—'}</dd></div><div><dt>Estimated remaining principal</dt><dd>{ron(latest.result.remainingCredit)}</dd></div><div><dt>Estimated interest saved</dt><dd>{ron(latest.result.totalInterestSaved)}</dd></div></dl>
    <p className="reference-note">{scenarioReferenceLabel(latest)}</p><p className="reference-note">Hypothetical result. Your bank schedule is unchanged.</p><button className="secondary-button" onClick={onOpenPlanner}>Open Scenarios ›</button></>
    : <div className="overview-empty"><strong>No saved scenario yet</strong><p>Explore how an extra payment could change your mortgage.</p><button className="primary-button" onClick={onOpenPlanner}>Create a scenario ›</button></div>}
</section>;
