import {
  getDocument,
  GlobalWorkerOptions
} from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  AppWarning,
  ColumnDetection,
  ExtractionMeta,
  PdfParseResult,
  ScheduleRow
} from '../types';
import {
  creditAliases,
  detectHeaderCandidate,
  interestAliases,
  installmentAliases
} from '../utils/headerDetection';
import { parseFlexibleNumber } from '../utils/number';
import {
  createRowId,
  createScheduleRow,
  findDuplicateInstallments,
  sortRows
} from '../utils/rows';
import { parseScheduleDateFromText } from '../utils/scheduleDate';

GlobalWorkerOptions.workerSrc = workerSrc;

interface PositionedText {
  text: string;
  x: number;
  y: number;
  width: number;
}

interface PdfTextContentLike {
  items: unknown[];
}

interface LineSegment {
  text: string;
  x: number;
  width: number;
}

interface PdfTextLine {
  pageNumber: number;
  lineIndex: number;
  text: string;
  items: PositionedText[];
  segments: LineSegment[];
}

interface ActiveColumns {
  installmentX: number | null;
  creditX: number | null;
  interestX: number | null;
  installmentColumn: ColumnDetection;
  creditColumn: ColumnDetection;
  interestColumn: ColumnDetection;
}

const MAX_REASONABLE_INSTALLMENT_NUMBER = 600;

const buildWarning = (message: string, severity: AppWarning['severity']): AppWarning => ({
  id: createRowId(),
  message,
  severity
});

const bySourceOrder = (left: ScheduleRow, right: ScheduleRow): number => {
  const leftPage = left.sourcePage ?? 0;
  const rightPage = right.sourcePage ?? 0;

  if (leftPage !== rightPage) {
    return leftPage - rightPage;
  }

  const leftRow = left.sourceRowIndex ?? 0;
  const rightRow = right.sourceRowIndex ?? 0;

  return leftRow - rightRow;
};

const buildSegments = (items: PositionedText[], joinWords = false): LineSegment[] => {
  const sorted = [...items].sort((left, right) => left.x - right.x);
  const segments: LineSegment[] = [];

  sorted.forEach((item) => {
    const previous = segments[segments.length - 1];

    if (!previous) {
      segments.push({ text: item.text, x: item.x, width: item.width });
      return;
    }

    const previousEnd = previous.x + previous.width;
    const gap = item.x - previousEnd;
    const shouldMerge =
      gap < (joinWords ? 18 : 10) ||
      item.text.startsWith(',') ||
      item.text.startsWith('.') ||
      previous.text.endsWith(',') ||
      previous.text.endsWith('.');

    if (shouldMerge) {
      previous.text = `${previous.text}${joinWords ? ' ' : ''}${item.text}`.trim();
      previous.width = item.x + item.width - previous.x;
      return;
    }

    segments.push({ text: item.text, x: item.x, width: item.width });
  });

  return segments;
};

const lineToText = (segments: LineSegment[]): string => segments.map((segment) => segment.text).join(' ');

const normalizeInstallmentToken = (value: string): string =>
  value
    .trim()
    .replace(/[.)]\s*$/, '')
    .replace(/\s+/g, '');

const parseInstallmentNumber = (
  input: string | number | null | undefined
): number | null => {
  if (typeof input === 'number') {
    return Number.isInteger(input) &&
      input > 0 &&
      input <= MAX_REASONABLE_INSTALLMENT_NUMBER
      ? input
      : null;
  }

  if (input == null) {
    return null;
  }

  const normalized = normalizeInstallmentToken(input);

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0 ||
    parsed > MAX_REASONABLE_INSTALLMENT_NUMBER ||
    (parsed >= 1900 && parsed <= 2100)
  ) {
    return null;
  }

  return parsed;
};

const extractLinesFromTextContent = (
  textContent: PdfTextContentLike,
  pageNumber: number
): PdfTextLine[] => {
  const items = textContent.items
    .filter(
      (
        item
      ): item is {
        str: string;
        transform: number[];
        width?: number;
      } =>
        typeof item === 'object' &&
        item !== null &&
        'str' in item &&
        typeof item.str === 'string' &&
        'transform' in item &&
        Array.isArray(item.transform)
    )
    .map((item) => ({
      text: item.str!.trim(),
      x: item.transform[4],
      y: item.transform[5],
      width: item.width || item.str.length * 6
    }))
    .filter((item) => item.text.length > 0)
    .sort((left, right) => right.y - left.y || left.x - right.x);

  const buckets: PositionedText[][] = [];

  items.forEach((item) => {
    const bucket = buckets.find((candidate) => Math.abs(candidate[0].y - item.y) <= 3);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.push([item]);
    }
  });

  return buckets.map((bucket, lineIndex) => {
    const orderedItems = bucket.sort((left, right) => left.x - right.x);
    const segments = buildSegments(orderedItems);
    return {
      pageNumber,
      lineIndex,
      text: lineToText(segments),
      items: orderedItems,
      segments
    };
  });
};

const pickClosestNumericSegment = (
  segments: LineSegment[],
  x: number | null,
  parser: (value: string) => number | null
): { value: number; segment: LineSegment } | null => {
  const candidates = segments
    .map((segment) => ({
      segment,
      value: parser(segment.text),
      distance: x == null ? 0 : Math.abs(segment.x + segment.width / 2 - x)
    }))
    .filter(
      (candidate): candidate is {
        segment: LineSegment;
        value: number;
        distance: number;
      } => candidate.value != null
    )
    .sort((left, right) => left.distance - right.distance);

  return candidates[0] ? { value: candidates[0].value, segment: candidates[0].segment } : null;
};

const pickOptionalNumericSegment = (
  segments: LineSegment[],
  x: number | null
): { value: number; segment: LineSegment } | null => {
  if (x == null) {
    return null;
  }

  return pickClosestNumericSegment(segments, x, parseFlexibleNumber);
};

const detectColumnsFromSegments = (segments: LineSegment[]): ActiveColumns | null => {
  const headerSegments = buildSegments(
    segments.map((segment) => ({
      text: segment.text,
      x: segment.x,
      y: 0,
      width: segment.width
    })),
    true
  );

  let installmentMatch: {
    x: number | null;
    confidence: number;
    label?: string;
  } = { x: null, confidence: 0 };
  let creditMatch: {
    x: number | null;
    confidence: number;
    label?: string;
  } = { x: null, confidence: 0 };
  let interestMatch: {
    x: number | null;
    confidence: number;
    label?: string;
  } = { x: null, confidence: 0 };

  headerSegments.forEach((segment) => {
    const normalizedHeader = segment.text.toLowerCase();
    const looksLikeDateHeader =
      normalizedHeader.includes('data') ||
      normalizedHeader.includes('date') ||
      normalizedHeader.includes('scad') ||
      normalizedHeader.includes('due');

    const installmentCandidate = detectHeaderCandidate(segment.text, installmentAliases);
    if (
      installmentCandidate &&
      !looksLikeDateHeader &&
      installmentCandidate.confidence > installmentMatch.confidence
    ) {
      installmentMatch = {
        x: segment.x + segment.width / 2,
        confidence: installmentCandidate.confidence,
        label: installmentCandidate.label
      };
    }

    const creditCandidate = detectHeaderCandidate(segment.text, creditAliases);
    if (creditCandidate && creditCandidate.confidence > creditMatch.confidence) {
      creditMatch = {
        x: segment.x + segment.width / 2,
        confidence: creditCandidate.confidence,
        label: creditCandidate.label
      };
    }

    const interestCandidate = detectHeaderCandidate(segment.text, interestAliases);
    if (interestCandidate && interestCandidate.confidence > interestMatch.confidence) {
      interestMatch = {
        x: segment.x + segment.width / 2,
        confidence: interestCandidate.confidence,
        label: interestCandidate.label
      };
    }

  });

  if (
    installmentMatch.confidence <= 0.4 &&
    creditMatch.confidence <= 0.4 &&
    interestMatch.confidence <= 0.4
  ) {
    return null;
  }

  return {
    installmentX: installmentMatch.x,
    creditX: creditMatch.x,
    interestX: interestMatch.x,
    installmentColumn: {
      confidence: installmentMatch.confidence,
      label: installmentMatch.label
    },
    creditColumn: {
      confidence: creditMatch.confidence,
      label: creditMatch.label
    },
    interestColumn: {
      confidence: interestMatch.confidence,
      label: interestMatch.label
    }
  };
};

const pickBetterColumn = (
  current: ColumnDetection,
  next: ColumnDetection
): ColumnDetection => (next.confidence > current.confidence ? next : current);

const mergeActiveColumns = (current: ActiveColumns | null, next: ActiveColumns): ActiveColumns => {
  if (!current) {
    return next;
  }

  const installmentColumn = pickBetterColumn(current.installmentColumn, next.installmentColumn);
  const creditColumn = pickBetterColumn(current.creditColumn, next.creditColumn);
  const interestColumn = pickBetterColumn(current.interestColumn, next.interestColumn);

  return {
    installmentX:
      installmentColumn === next.installmentColumn ? next.installmentX : current.installmentX,
    creditX: creditColumn === next.creditColumn ? next.creditX : current.creditX,
    interestX: interestColumn === next.interestColumn ? next.interestX : current.interestX,
    installmentColumn,
    creditColumn,
    interestColumn
  };
};

const looksLikeRowNoise = (text: string): boolean => {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('total') ||
    normalized.includes('dobanda') ||
    normalized.includes('interest') ||
    normalized.includes('sold') ||
    normalized.includes('balance')
  );
};

const fallbackRowParse = (line: PdfTextLine): ScheduleRow | null => {
  const numericSegments = line.segments.filter(
    (segment) => parseFlexibleNumber(segment.text) != null
  );

  if (numericSegments.length < 2 || looksLikeRowNoise(line.text)) {
    return null;
  }

  const installmentCandidate = numericSegments
    .map((segment) => parseInstallmentNumber(segment.text))
    .find((value) => value != null);
  const creditCandidate = [...numericSegments]
    .reverse()
    .map((segment) => parseFlexibleNumber(segment.text))
    .find((value) => value != null);

  if (installmentCandidate == null || creditCandidate == null) {
    return null;
  }

  return createScheduleRow({
    id: createRowId(),
    installmentNumber: installmentCandidate,
    creditAmount: creditCandidate,
    paymentDate: parseScheduleDateFromText(line.text) ?? undefined,
    rawRowData: {
      lineText: line.text,
      segmentText: line.segments.map((segment) => segment.text).join(' | ')
    },
    sourcePage: line.pageNumber,
    sourceRowIndex: line.lineIndex
  });
};

const parseRowWithColumns = (
  line: PdfTextLine,
  activeColumns: ActiveColumns
): ScheduleRow | null => {
  if (looksLikeRowNoise(line.text)) {
    return null;
  }

  const installmentSegment = pickClosestNumericSegment(
    line.segments,
    activeColumns.installmentX,
    parseInstallmentNumber
  );
  const creditSegment = pickClosestNumericSegment(
    line.segments,
    activeColumns.creditX,
    parseFlexibleNumber
  );
  const interestSegment = pickOptionalNumericSegment(line.segments, activeColumns.interestX);

  if (!installmentSegment || !creditSegment) {
    return fallbackRowParse(line);
  }

  return createScheduleRow({
    id: createRowId(),
    installmentNumber: installmentSegment.value,
    creditAmount: creditSegment.value,
    interestAmount: interestSegment?.value,
    paymentDate: parseScheduleDateFromText(line.text) ?? undefined,
    rawRowData: {
      lineText: line.text,
      segmentText: line.segments.map((segment) => segment.text).join(' | '),
      installmentCell: installmentSegment.segment.text,
      creditCell: creditSegment.segment.text,
      interestCell: interestSegment?.segment.text ?? ''
    },
    sourcePage: line.pageNumber,
    sourceRowIndex: line.lineIndex
  });
};

const hasStrongInstallmentSequence = (rows: ScheduleRow[]): boolean => {
  if (rows.length < 3) {
    return true;
  }

  const orderedRows = [...rows].sort(bySourceOrder);
  const uniqueInstallments = new Set(orderedRows.map((row) => row.installmentNumber)).size;
  let consecutiveSteps = 0;

  for (let index = 1; index < orderedRows.length; index += 1) {
    if (orderedRows[index]!.installmentNumber - orderedRows[index - 1]!.installmentNumber === 1) {
      consecutiveSteps += 1;
    }
  }

  const uniqueRatio = uniqueInstallments / orderedRows.length;
  const consecutiveRatio = consecutiveSteps / Math.max(1, orderedRows.length - 1);

  return uniqueRatio > 0.9 && consecutiveRatio > 0.65;
};

const normalizeInstallmentSequence = (rows: ScheduleRow[]): ScheduleRow[] => {
  const orderedRows = [...rows].sort(bySourceOrder);
  const startCounts = new Map<number, number>();

  orderedRows.forEach((row, index) => {
    const proposedStart = row.installmentNumber - index;

    if (proposedStart > 0) {
      startCounts.set(proposedStart, (startCounts.get(proposedStart) ?? 0) + 1);
    }
  });

  const bestStart =
    [...startCounts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ??
    1;

  return orderedRows.map((row, index) =>
    createScheduleRow({
      ...row,
      installmentNumber: bestStart + index
    })
  );
};

export const parseSchedulePdf = async (file: File): Promise<PdfParseResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const warnings: AppWarning[] = [];
  const allLines: PdfTextLine[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    allLines.push(...extractLinesFromTextContent(textContent, pageNumber));
  }

  let activeColumns: ActiveColumns | null = null;
  let bestInstallmentColumn: ColumnDetection = { confidence: 0 };
  let bestCreditColumn: ColumnDetection = { confidence: 0 };
  let bestInterestColumn: ColumnDetection = { confidence: 0 };
  let lastInterestAmount: number | undefined;
  const extractedRows: ScheduleRow[] = [];

  allLines.forEach((line) => {
    const detectedColumns = detectColumnsFromSegments(line.segments);

    if (detectedColumns) {
      activeColumns = mergeActiveColumns(activeColumns, detectedColumns);

      if (activeColumns.installmentColumn.confidence > bestInstallmentColumn.confidence) {
        bestInstallmentColumn = activeColumns.installmentColumn;
      }

      if (activeColumns.creditColumn.confidence > bestCreditColumn.confidence) {
        bestCreditColumn = activeColumns.creditColumn;
      }

      if (activeColumns.interestColumn.confidence > bestInterestColumn.confidence) {
        bestInterestColumn = activeColumns.interestColumn;
      }

      return;
    }

    const interestValue = activeColumns
      ? pickOptionalNumericSegment(line.segments, activeColumns.interestX)?.value
      : undefined;

    if (interestValue != null) {
      lastInterestAmount = interestValue;
    }

    const parsedRow = activeColumns
      ? parseRowWithColumns(line, activeColumns)
      : fallbackRowParse(line);

    if (parsedRow) {
      extractedRows.push(parsedRow);
    }
  });

  const filteredRows = extractedRows.filter(
    (row) =>
      Number.isFinite(row.installmentNumber) &&
      row.installmentNumber > 0 &&
      Number.isFinite(row.creditAmount) &&
      row.creditAmount >= 0
  );

  const normalizedRows = hasStrongInstallmentSequence(filteredRows)
    ? filteredRows
    : normalizeInstallmentSequence(filteredRows);
  const rows = sortRows(normalizedRows);

  if (bestCreditColumn.confidence > 0 && bestCreditColumn.confidence < 0.75) {
    warnings.push(buildWarning('Principal column detected with low confidence.', 'warning'));
  }

  if (!rows.length) {
    warnings.push(
      buildWarning('No repayment rows could be extracted. You can add them manually.', 'error')
    );
  } else {
    warnings.push(buildWarning('Some rows may need manual correction.', 'info'));
  }

  if (filteredRows.length > 0 && !hasStrongInstallmentSequence(filteredRows)) {
    warnings.push(
      buildWarning(
        'Installment numbers were normalized from document order because the PDF column was ambiguous.',
        'warning'
      )
    );
  }

  const duplicates = findDuplicateInstallments(rows);
  if (duplicates.length > 0) {
    warnings.push(buildWarning('Duplicate installment numbers detected.', 'warning'));
  }

  const meta: ExtractionMeta = {
    sourceFileName: file.name,
    parsedPages: pdf.numPages,
    installmentColumn: bestInstallmentColumn,
    creditColumn: bestCreditColumn,
    interestColumn: bestInterestColumn,
    lastInterestAmount,
    extractedAt: new Date().toISOString()
  };

  return {
    rows,
    warnings,
    meta
  };
};
