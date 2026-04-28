const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const roundToCents = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const toCents = (value: number): number =>
  Math.round((roundToCents(value) + Number.EPSILON) * 100);

export const fromCents = (value: number): number => roundToCents(value / 100);

export const formatMoney = (value: number): string => moneyFormatter.format(roundToCents(value));

export const formatEditableMoney = (value: number): string =>
  roundToCents(value).toFixed(2);

const stripNumberNoise = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\d,.-]/g, '');

const normalizeWithSeparator = (value: string, decimalSeparator: ',' | '.'): string => {
  const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
  return value.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
};

export const parseFlexibleNumber = (
  input: string | number | null | undefined
): number | null => {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? roundToCents(input) : null;
  }

  if (input == null) {
    return null;
  }

  const cleaned = stripNumberNoise(input);

  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') {
    return null;
  }

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized =
      cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? normalizeWithSeparator(cleaned, ',')
        : normalizeWithSeparator(cleaned, '.');
  } else if (hasComma) {
    const parts = cleaned.split(',');
    const lastPart = parts[parts.length - 1];
    normalized =
      parts.length > 1 && lastPart?.length !== 3
        ? normalizeWithSeparator(cleaned, ',')
        : cleaned.split(',').join('');
  } else if (hasDot) {
    const parts = cleaned.split('.');
    const lastPart = parts[parts.length - 1];
    normalized =
      parts.length > 1 && lastPart?.length !== 3
        ? normalizeWithSeparator(cleaned, '.')
        : cleaned.split('.').join('');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? roundToCents(parsed) : null;
};

export const parsePositiveInteger = (
  input: string | number | null | undefined
): number | null => {
  const parsed = parseFlexibleNumber(input);
  if (parsed == null) {
    return null;
  }

  const integer = Math.trunc(parsed);
  return integer > 0 && Math.abs(integer - parsed) < 0.0001 ? integer : null;
};
