import { useEffect, useMemo, useState } from 'react';
import { CalculationCard } from '../components/CalculationCard';
import { FirstUnpaidSelector } from '../components/FirstUnpaidSelector';
import { HistoryCard } from '../components/HistoryCard';
import { ResultsCard } from '../components/ResultsCard';
import { ScheduleEditor } from '../components/ScheduleEditor';
import { StickyActions } from '../components/StickyActions';
import { SummaryCard } from '../components/SummaryCard';
import { UploadCard } from '../components/UploadCard';
import { WarningCard } from '../components/WarningCard';
import { uiText } from '../content/uiText';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  AppWarning,
  ExtractionMeta,
  ScheduleRow,
  StoredCalculationResult
} from '../types';
import { calculateByAmount, calculateByMonths } from '../utils/calculations';
import { parseFlexibleNumber, parsePositiveInteger } from '../utils/number';
import { createScheduleRow, createRowId, findDuplicateInstallments, sortRows } from '../utils/rows';

const STORAGE_KEYS = {
  rows: 'mortgage.rows',
  warnings: 'mortgage.warnings',
  meta: 'mortgage.meta',
  firstUnpaidInstallment: 'mortgage.firstUnpaidInstallment',
  recentResults: 'mortgage.recentResults',
  amountDraft: 'mortgage.amountDraft',
  monthsDraft: 'mortgage.monthsDraft'
} as const;

const buildWarning = (message: string, severity: AppWarning['severity'] = 'warning'): AppWarning => ({
  id: createRowId(),
  message,
  severity
});

const appendRecentResult = (
  current: StoredCalculationResult[],
  next: StoredCalculationResult
): StoredCalculationResult[] => [next, ...current].slice(0, 8);

const downloadJson = (payload: object, filename: string) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const HomePage = () => {
  const [rows, setRows] = useLocalStorage<ScheduleRow[]>(STORAGE_KEYS.rows, []);
  const [warnings, setWarnings] = useLocalStorage<AppWarning[]>(STORAGE_KEYS.warnings, []);
  const [meta, setMeta] = useLocalStorage<ExtractionMeta | null>(STORAGE_KEYS.meta, null);
  const [firstUnpaidInstallment, setFirstUnpaidInstallment] = useLocalStorage<number | null>(
    STORAGE_KEYS.firstUnpaidInstallment,
    null
  );
  const [recentResults, setRecentResults] = useLocalStorage<StoredCalculationResult[]>(
    STORAGE_KEYS.recentResults,
    []
  );
  const [amountDraft, setAmountDraft] = useLocalStorage<string>(STORAGE_KEYS.amountDraft, '');
  const [monthsDraft, setMonthsDraft] = useLocalStorage<string>(STORAGE_KEYS.monthsDraft, '');
  const [isParsing, setIsParsing] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [monthsError, setMonthsError] = useState<string | null>(null);

  const sortedRows = useMemo(() => sortRows(rows), [rows]);

  useEffect(() => {
    if (!sortedRows.length) {
      setFirstUnpaidInstallment(null);
      return;
    }

    const hasCurrentSelection = sortedRows.some(
      (row) => row.installmentNumber === firstUnpaidInstallment
    );

    if (!hasCurrentSelection) {
      setFirstUnpaidInstallment(sortedRows[0].installmentNumber);
    }
  }, [firstUnpaidInstallment, setFirstUnpaidInstallment, sortedRows]);

  useEffect(() => {
    const duplicates = findDuplicateInstallments(sortedRows);

    setWarnings((currentWarnings) => {
      const baseWarnings = currentWarnings.filter(
        (warning) => warning.message !== 'Duplicate installment numbers detected.'
      );

      if (!duplicates.length) {
        return baseWarnings;
      }

      return [...baseWarnings, buildWarning('Duplicate installment numbers detected.', 'warning')];
    });
  }, [setWarnings, sortedRows]);

  const handleSelectPdf = async (file: File) => {
    setIsParsing(true);
    setAmountError(null);
    setMonthsError(null);

    try {
      const { parseSchedulePdf } = await import('../services/pdfScheduleParser');
      const result = await parseSchedulePdf(file);
      setRows(result.rows);
      setWarnings(result.warnings);
      setMeta(result.meta);
      setFirstUnpaidInstallment(result.rows[0]?.installmentNumber ?? null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The PDF could not be parsed in the browser.';
      setWarnings([buildWarning(message, 'error')]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdateRow = (rowId: string, changes: Partial<ScheduleRow>) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, ...changes } : row))
    );
  };

  const handleDeleteRow = (rowId: string) => {
    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  };

  const handleAddRow = () => {
    setRows((currentRows) => {
      const nextInstallmentNumber = currentRows.length
        ? Math.max(...currentRows.map((row) => row.installmentNumber)) + 1
        : 1;

      return [
        ...currentRows,
        createScheduleRow({
          installmentNumber: nextInstallmentNumber,
          creditAmount: 0
        })
      ];
    });
  };

  const handleSortRows = () => {
    setRows((currentRows) => sortRows(currentRows));
  };

  const addResultToHistory = (inputValue: number, result: StoredCalculationResult['result']) => {
    setRecentResults((currentResults) =>
      appendRecentResult(currentResults, {
        id: createRowId(),
        createdAt: new Date().toISOString(),
        inputValue,
        result
      })
    );
  };

  const handleCalculateByAmount = () => {
    setAmountError(null);

    try {
      const amount = parseFlexibleNumber(amountDraft);
      const selectedInstallment = firstUnpaidInstallment;

      if (selectedInstallment == null) {
        throw new Error('Please upload a PDF first.');
      }

      const result = calculateByAmount({
        rows,
        firstUnpaidInstallment: selectedInstallment,
        amount: amount ?? 0
      });

      addResultToHistory(amount ?? 0, result);
    } catch (error) {
      setAmountError(error instanceof Error ? error.message : 'Calculation failed.');
    }
  };

  const handleCalculateByMonths = () => {
    setMonthsError(null);

    try {
      const monthsToCover = parsePositiveInteger(monthsDraft);
      const selectedInstallment = firstUnpaidInstallment;

      if (selectedInstallment == null) {
        throw new Error('Please upload a PDF first.');
      }

      const result = calculateByMonths({
        rows,
        firstUnpaidInstallment: selectedInstallment,
        monthsToCover: monthsToCover ?? 0
      });

      addResultToHistory(monthsToCover ?? 0, result);
    } catch (error) {
      setMonthsError(error instanceof Error ? error.message : 'Calculation failed.');
    }
  };

  const handleExportJson = () => {
    downloadJson(
      {
        rows,
        firstUnpaidInstallment,
        warnings,
        meta,
        recentResults
      },
      'mortgage-schedule.json'
    );
  };

  const handleClearData = () => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
    });
    setRows([]);
    setWarnings([]);
    setMeta(null);
    setFirstUnpaidInstallment(null);
    setRecentResults([]);
    setAmountDraft('');
    setMonthsDraft('');
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero__badge">PWA | Offline | No backend</div>
        <h1>{uiText.appTitle}</h1>
        <p>{uiText.appSubtitle}</p>
      </header>

      <UploadCard
        title={uiText.uploadTitle}
        description={uiText.uploadDescription}
        sourceFileName={meta?.sourceFileName ?? null}
        isParsing={isParsing}
        onSelectPdf={handleSelectPdf}
      />

      <SummaryCard
        title={uiText.summaryTitle}
        rows={sortedRows}
        firstUnpaidInstallment={firstUnpaidInstallment}
        meta={meta}
      />

      <WarningCard title={uiText.warningsTitle} warnings={warnings} />

      <FirstUnpaidSelector
        title={uiText.firstUnpaidTitle}
        rows={sortedRows}
        value={firstUnpaidInstallment}
        onChange={setFirstUnpaidInstallment}
      />

      <div className="card-grid">
        <CalculationCard
          title={uiText.amountTitle}
          inputLabel="Available amount"
          inputPlaceholder="e.g. 7000"
          value={amountDraft}
          helperText="Adds principal values without exceeding the entered amount."
          buttonLabel="Calculate"
          error={amountError}
          onValueChange={setAmountDraft}
          onSubmit={handleCalculateByAmount}
        />
        <CalculationCard
          title={uiText.monthsTitle}
          inputLabel="Number of months"
          inputPlaceholder="e.g. 10"
          value={monthsDraft}
          helperText="Adds the next N installments starting from the first unpaid installment."
          buttonLabel="Calculate"
          error={monthsError}
          onValueChange={setMonthsDraft}
          onSubmit={handleCalculateByMonths}
        />
      </div>

      <ResultsCard title={uiText.resultsTitle} results={recentResults} />

      <ScheduleEditor
        title={uiText.tableTitle}
        rows={sortedRows}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        onUpdateRow={handleUpdateRow}
        onSortRows={handleSortRows}
      />

      <HistoryCard title={uiText.historyTitle} results={recentResults} />

      <StickyActions
        onExportJson={handleExportJson}
        onClearData={handleClearData}
        note={uiText.stickyNote}
      />
    </main>
  );
};
