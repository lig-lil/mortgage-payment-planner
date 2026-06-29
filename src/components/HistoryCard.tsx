import { useMemo, useState } from 'react';
import { StoredCalculationResult } from '../types';
import { formatMoney } from '../utils/number';

interface HistoryCardProps {
  results: StoredCalculationResult[];
  onOpenScenario: (scenarioId: string) => void;
  onExportScenarioCsv: (scenario: StoredCalculationResult) => void;
}

const getScenarioType = (entry: StoredCalculationResult) => entry.scenarioType ?? entry.result.type;

const getScenarioLabel = (entry: StoredCalculationResult) => {
  const scenarioType = getScenarioType(entry);

  if (scenarioType === 'interest') {
    return 'Interest comparison';
  }

  return scenarioType === 'amount' ? 'By amount' : 'By months';
};

const formatHistoryDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = date.toLocaleString('en-GB', { day: '2-digit' });
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.toLocaleString('en-GB', { year: 'numeric' });
  const time = date.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return `${day} ${month} ${year} - ${time}`;
};

const getScenarioInput = (entry: StoredCalculationResult) => {
  const scenarioType = getScenarioType(entry);

  if (scenarioType === 'months') {
    return `${entry.result.type === 'months' ? entry.result.monthsRequested : entry.inputValue} months`;
  }

  if (scenarioType === 'interest') {
    return formatMoney(entry.result.newInterestAmount ?? entry.inputValue);
  }

  return formatMoney(entry.inputValue);
};

const getScenarioCovered = (entry: StoredCalculationResult) => {
  const scenarioType = getScenarioType(entry);

  if (scenarioType === 'interest') {
    return '-';
  }

  return `${entry.result.monthsCovered} of ${entry.result.totalScheduleMonths}`;
};

const getScenarioResult = (entry: StoredCalculationResult) => {
  const scenarioType = getScenarioType(entry);

  if (scenarioType === 'interest') {
    return entry.result.totalInterestSaved == null ? '-' : formatMoney(entry.result.totalInterestSaved);
  }

  return formatMoney(
    entry.result.type === 'amount'
      ? entry.result.totalCreditCovered
      : entry.result.totalAmountRequired
  );
};

export const HistoryCard = ({ results, onOpenScenario, onExportScenarioCsv }: HistoryCardProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'amount' | 'months' | 'interest'>('all');
  const [dateFilter, setDateFilter] = useState<'30' | '90' | 'all'>('all');

  const historyEntries = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const now = Date.now();

    return results.filter((entry) => {
      const scenarioType = getScenarioType(entry);
      const createdAt = new Date(entry.createdAt).getTime();
      const ageInDays = Number.isFinite(createdAt) ? (now - createdAt) / 86_400_000 : 0;
      const haystack = [
        getScenarioLabel(entry),
        getScenarioInput(entry),
        getScenarioCovered(entry),
        getScenarioResult(entry),
        formatHistoryDate(entry.createdAt)
      ].join(' ').toLowerCase();

      return (
        (typeFilter === 'all' || scenarioType === typeFilter) &&
        (dateFilter === 'all' || ageInDays <= Number(dateFilter)) &&
        (!normalizedSearch || haystack.includes(normalizedSearch))
      );
    });
  }, [dateFilter, results, searchQuery, typeFilter]);

  return (
    <section className="history-panel">
      <div className="history-toolbar">
        <label className="history-search">
          <span aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search scenarios..."
          />
        </label>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
          <option value="all">All types</option>
          <option value="amount">By amount</option>
          <option value="months">By months</option>
          <option value="interest">Interest saved</option>
        </select>
        <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as typeof dateFilter)}>
          <option value="all">All time</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      <div className="history-table" role="table" aria-label="Saved scenarios">
        <div className="history-table__head" role="row">
          <span role="columnheader">Scenario</span>
          <span role="columnheader">Input</span>
          <span role="columnheader">Covered</span>
          <span role="columnheader">Result</span>
          <span role="columnheader" aria-label="Actions" />
        </div>
        {historyEntries.map((entry) => (
          <div key={entry.id} className="history-row" role="row">
            <div className="history-row__scenario" role="cell">
              <span className={`history-dot history-dot--${getScenarioType(entry)}`} aria-hidden="true" />
              <div>
                <strong>{getScenarioLabel(entry)}</strong>
                <span>{formatHistoryDate(entry.createdAt)}</span>
              </div>
            </div>
            <span className="history-row__mono" role="cell">{getScenarioInput(entry)}</span>
            <span className="history-row__mono" role="cell">{getScenarioCovered(entry)}</span>
            <span
              className={`history-row__mono history-row__result${
                getScenarioType(entry) === 'interest' && entry.result.totalInterestSaved != null && entry.result.totalInterestSaved < 0
                  ? ' history-row__result--negative'
                  : ''
              }`}
              role="cell"
            >
              {getScenarioResult(entry)}
            </span>
            <div className="history-row__actions" role="cell">
              <button type="button" className="secondary-button" onClick={() => onOpenScenario(entry.id)}>
                Open
              </button>
              <button type="button" className="secondary-button" onClick={() => onExportScenarioCsv(entry)}>
                CSV
              </button>
            </div>
          </div>
        ))}

        {!historyEntries.length ? (
          <div className="history-empty" role="row">
            <p>No scenarios match these filters yet.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
};
