const monthNames: Record<string, number> = {
  jan: 1,
  january: 1,
  ian: 1,
  ianuarie: 1,
  feb: 2,
  february: 2,
  februarie: 2,
  mar: 3,
  march: 3,
  martie: 3,
  apr: 4,
  april: 4,
  aprilie: 4,
  may: 5,
  mai: 5,
  jun: 6,
  june: 6,
  iun: 6,
  iunie: 6,
  jul: 7,
  july: 7,
  iul: 7,
  iulie: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  septembrie: 9,
  oct: 10,
  october: 10,
  octombrie: 10,
  nov: 11,
  november: 11,
  noiembrie: 11,
  dec: 12,
  december: 12,
  decembrie: 12
};

const normalizeMonthName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.$/, '');

export const toIsoScheduleDate = (day: number, month: number, year: number): string | null => {
  const normalizedYear = year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(normalizedYear, month - 1, day));

  if (
    date.getUTCFullYear() !== normalizedYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

export const parseScheduleDateFromText = (text: string): string | null => {
  const numericDate = text.match(/\b(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})\b/);

  if (numericDate) {
    return toIsoScheduleDate(Number(numericDate[1]), Number(numericDate[2]), Number(numericDate[3]));
  }

  const isoDate = text.match(/\b(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})\b/);

  if (isoDate) {
    return toIsoScheduleDate(Number(isoDate[3]), Number(isoDate[2]), Number(isoDate[1]));
  }

  const namedMonthDate = text.match(
    /\b(\d{1,2})\s*[- ]\s*([A-Za-z\u00C0-\u017F]{3,12}\.?)\s*[- ]\s*(\d{2,4})\b/
  );

  if (namedMonthDate) {
    const month = monthNames[normalizeMonthName(namedMonthDate[2])];

    if (month) {
      return toIsoScheduleDate(Number(namedMonthDate[1]), month, Number(namedMonthDate[3]));
    }
  }

  const compactDate = text.match(/\b(\d{2})(\d{2})(20\d{2})\b/);

  if (compactDate) {
    return toIsoScheduleDate(Number(compactDate[1]), Number(compactDate[2]), Number(compactDate[3]));
  }

  return null;
};

export const formatScheduleDate = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();

  return `${day}-${month}-${year}`;
};
