import { ExtractionMeta, ScheduleReference, ScheduleRow, StoredCalculationResult } from '../types';
import { sortRows } from './rows';

export const createScheduleReference = (rows: ScheduleRow[], meta: ExtractionMeta | null): ScheduleReference => ({
  sourceFileName: meta?.sourceFileName ?? null, extractedAt: meta?.extractedAt ?? null,
  version: JSON.stringify([meta?.sourceFileName, meta?.extractedAt, meta?.lastInterestAmount, sortRows(rows)])
});
export const scenarioReferenceStatus = (entry: StoredCalculationResult, current: ScheduleReference): 'current' | 'different' | 'legacy-unknown' =>
  !entry.referenceSchedule ? 'legacy-unknown' : entry.referenceSchedule.version === current.version ? 'current' : 'different';
export const formatReferenceTimestamp = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'date unavailable' : date.toISOString().slice(0, 19).replace('T', ' ');
};
export const scenarioReferenceLabel = (entry: StoredCalculationResult, formatTimestamp: (value: string) => string = value => value): string => entry.referenceSchedule
  ? `Saved against ${entry.referenceSchedule.sourceFileName ?? 'manual schedule'} (${entry.referenceSchedule.extractedAt ? formatTimestamp(entry.referenceSchedule.extractedAt) : 'date unavailable'})`
  : 'Legacy scenario: reference schedule unknown';
