import { ScheduleRow, ExtractionMeta, PreviousScheduleSnapshot, ScheduleComparison } from '../types';
import { principalRows } from './rows';
import { createRealScheduleSnapshot, compareRealSchedules } from './scheduleComparison';

export const initializeBoundaries = (rows: ScheduleRow[], actualId: string | null, scenarioId: string | null) => {
  const payments = principalRows(rows);
  const valid = (id: string | null) => id != null && payments.some(row => row.id === id);
  return {
    actualFirstUnpaidRowId: valid(actualId) ? actualId : payments[0]?.id ?? null,
    scenarioStartingRowId: valid(scenarioId) ? scenarioId : payments[1]?.id ?? payments[0]?.id ?? null
  };
};

export const createActualScheduleSnapshot = (rows: ScheduleRow[], meta: ExtractionMeta | null, actualId: string | null): PreviousScheduleSnapshot | null => {
  const snapshot = createRealScheduleSnapshot(rows, meta, actualId);
  if (!snapshot) return null;
  const payments = principalRows(rows);
  const index = payments.findIndex(row => row.id === actualId);
  return { ...snapshot, boundaryVersion: 'actual-v2', installmentsRemaining: index >= 0 ? payments.length - index : undefined };
};

/** Legacy snapshots captured a Planner selection, which cannot establish actual payment status. */
export const compareActualSchedules = (previous: PreviousScheduleSnapshot | null, current: PreviousScheduleSnapshot | null): ScheduleComparison | null => {
  const comparison = compareRealSchedules(previous, current);
  if (!comparison || previous?.boundaryVersion === 'actual-v2') return comparison;
  return { ...comparison, installmentsDelta: null, remainingInterestDelta: null, estimatedInterestSaved: null };
};
