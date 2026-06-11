const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const installmentAliases = [
  'nr crt',
  'nr crt.',
  'nrcrt',
  'numar curent',
  'installment number',
  'instalment number',
  'rate no',
  'nr rata'
];

export const creditAliases = [
  'credit',
  'principal',
  'principal amount',
  'valoare credit',
  'suma credit',
  'capital'
];

export const interestAliases = [
  'dob',
  'dobanda',
  'dobanzi',
  'dobanda totala',
  'dobanzi totale',
  'total dobanda',
  'total dobanzi',
  'interest',
  'interest amount',
  'total interest'
];

const scoreAlias = (text: string, alias: string): number => {
  if (!text) {
    return 0;
  }

  if (text === alias) {
    return 1;
  }

  if (text.includes(alias) || alias.includes(text)) {
    return 0.9;
  }

  const textTokens = new Set(text.split(' '));
  const aliasTokens = alias.split(' ');
  const matchedTokens = aliasTokens.filter((token) => textTokens.has(token)).length;

  if (!matchedTokens) {
    return 0;
  }

  return matchedTokens / aliasTokens.length;
};

export interface HeaderCandidate {
  label: string;
  confidence: number;
}

export const detectHeaderCandidate = (
  value: string,
  aliases: string[]
): HeaderCandidate | null => {
  const normalizedValue = normalize(value);

  let best: HeaderCandidate | null = null;

  for (const alias of aliases) {
    const score = scoreAlias(normalizedValue, normalize(alias));
    if (!best || score > best.confidence) {
      best = { label: alias, confidence: score };
    }
  }

  return best;
};

export const isLikelyHeader = (value: string): boolean => {
  const normalizedValue = normalize(value);
  const installmentConfidence =
    detectHeaderCandidate(normalizedValue, installmentAliases)?.confidence ?? 0;
  const creditConfidence =
    detectHeaderCandidate(normalizedValue, creditAliases)?.confidence ?? 0;

  return installmentConfidence > 0.55 || creditConfidence > 0.55;
};
