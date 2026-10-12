import { formatMoney } from './number';
import { formatScheduleDate } from './scheduleDate';
export const ron = (value: number | null | undefined): string => value == null || !Number.isFinite(value) ? '—' : `${formatMoney(value)} RON`;
export const scheduledDate = (value: string | null): string => value ? formatScheduleDate(value) || '—' : '—';
export const uploadedDate = (value?: string | null): string => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
