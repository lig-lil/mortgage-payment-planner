import { useState } from 'react';
import { ScheduleComparison } from '../types';
import { formatMoney } from '../utils/number';
import { formatScheduleDate } from '../utils/scheduleDate';

export const EstimatedInterestSavedCard = ({ comparison }: { comparison: ScheduleComparison | null }) => {
  const [expanded, setExpanded] = useState(false);
  const estimate = comparison?.estimatedInterestSaved;
  return (
    <section className="dashboard-panel estimated-interest" aria-labelledby="estimated-interest-title">
      <header className="latest-scenario-card__header estimated-interest__header">
        <h2 id="estimated-interest-title">ESTIMATED INTEREST SAVED</h2>
        <button type="button" className="estimated-interest__info" aria-label="How estimated interest saved is calculated"
          aria-expanded={expanded} aria-controls="estimated-interest-explanation" onClick={() => setExpanded(value => !value)}>{"\u24d8"}</button>
      </header>
      <p id="estimated-interest-explanation" className="schedule-changes__sources" hidden={!expanded}>
        Estimated interest saved compares the future interest in your previous schedule with the future interest in your current schedule, starting from the same next unpaid installment. Interest from installments already paid normally is excluded. Other changes to the mortgage schedule may also affect the estimate.
      </p>
      <p className="estimated-interest__amount">{estimate ? formatMoney(estimate.amount) + ' RON' : '\u2014'}</p>
      <p className="schedule-changes__sources">{estimate ? estimate.startDate ?
        'Compared from ' + formatScheduleDate(estimate.startDate).slice(3) + ' onward' :
        'Compared from installment ' + estimate.installmentNumber + ' onward' : comparison ?
        'Unable to determine a reliable saving from these schedules.' :
        'Upload an updated mortgage schedule to compare with your previous PDF.'}</p>
    </section>
  );
};
