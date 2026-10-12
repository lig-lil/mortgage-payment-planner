import { ExtractionMeta, LoanDetails, PdfParseResult, PreviousScheduleSnapshot, ScheduleRow } from '../types';
import { createRealScheduleSnapshot, isAcceptablePdfSchedule } from './scheduleComparison';

export interface ScheduleState {
  rows: ScheduleRow[];
  meta: ExtractionMeta | null;
  firstUnpaidRowId: string | null;
  previousScheduleSnapshot: PreviousScheduleSnapshot | null;
  loanDetails: LoanDetails;
}
/** Validate before any active state or previous snapshot is changed. */
export const acceptSchedule = (current: ScheduleState, result: PdfParseResult, firstUnpaidRowId: string | null): ScheduleState => {
  if (!isAcceptablePdfSchedule(result)) throw new Error('The PDF does not contain a valid repayment schedule. Your active and previous schedules were kept.');
  return { ...current, rows: result.rows, meta: result.meta, firstUnpaidRowId,
    previousScheduleSnapshot: createRealScheduleSnapshot(current.rows, current.meta, current.firstUnpaidRowId) };
};
