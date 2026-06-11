import { useEffect, useMemo, useState } from 'react';
import { CalculationCard } from '../components/CalculationCard';
import { FirstUnpaidSelector } from '../components/FirstUnpaidSelector';
import { HistoryCard } from '../components/HistoryCard';
import { ResultsCard } from '../components/ResultsCard';
import { ScheduleEditor } from '../components/ScheduleEditor';
import { StickyActions } from '../components/StickyActions';
import { SummaryCard } from '../components/SummaryCard';
import { UploadCard } from '../components/UploadCard';
import { uiText } from '../content/uiText';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  AppWarning,
  CalculationResult,
  ExtractionMeta,
  PlanningCalculationResult,
  ScheduleRow,
  StoredCalculationResult
} from '../types';
import {
  calculateByAmount,
  calculateByMonths,
  calculateInterestSavings,
  calculateMonthlyReimbursementPlanning
} from '../utils/calculations';
import { parseFlexibleNumber, parsePositiveInteger } from '../utils/number';
import {
  createScheduleRow,
  createRowId,
  findDuplicateInstallments,
  isPrincipalRow,
  principalRows,
  sortRows
} from '../utils/rows';

const STORAGE_KEYS = {
  rows: 'mortgage.rows',
  warnings: 'mortgage.warnings',
  meta: 'mortgage.meta',
  firstUnpaidRowId: 'mortgage.firstUnpaidRowId',
  legacyFirstUnpaidInstallment: 'mortgage.firstUnpaidInstallmentIndex',
  recentResults: 'mortgage.recentResults',
  amountDraft: 'mortgage.amountDraft',
  monthsDraft: 'mortgage.monthsDraft',
  interestDraft: 'mortgage.interestDraft',
  planningDraft: 'mortgage.planningDraft'
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

const getDefaultFirstUnpaidRowId = (rows: ScheduleRow[]): string | null => {
  const paymentRows = principalRows(rows);

  return paymentRows[1]?.id ?? null;
};

const readLegacyFirstUnpaidInstallment = (): number | null => {
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEYS.legacyFirstUnpaidInstallment);

    if (!storedValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    const installment = Number(parsedValue);

    return Number.isInteger(installment) && installment >= 2 ? installment : null;
  } catch {
    return null;
  }
};

const getLegacyFirstUnpaidRowId = (rows: ScheduleRow[]): string | null => {
  const legacyInstallment = readLegacyFirstUnpaidInstallment();

  if (legacyInstallment == null) {
    return null;
  }

  return principalRows(rows)[legacyInstallment - 1]?.id ?? null;
};

const getResultFirstUnpaidRowId = (
  result: CalculationResult,
  rows: ScheduleRow[]
): string | null => {
  const legacyResult = result as CalculationResult & {
    firstUnpaidRowId?: string;
    firstUnpaidInstallment?: number;
  };

  const paymentRows = principalRows(rows);

  if (legacyResult.firstUnpaidRowId) {
    const rowIndex = paymentRows.findIndex((row) => row.id === legacyResult.firstUnpaidRowId);

    return rowIndex >= 1 ? legacyResult.firstUnpaidRowId : getDefaultFirstUnpaidRowId(rows);
  }

  const fallbackInstallment = Math.max(2, legacyResult.firstUnpaidInstallment ?? 2);

  return paymentRows[fallbackInstallment - 1]?.id ?? null;
};

const applyStoredInterestSavings = (
  result: CalculationResult,
  storedResult: CalculationResult,
  rows: ScheduleRow[],
  lastInterestAmount?: number
): CalculationResult => {
  if (storedResult.newInterestAmount == null) {
    return result;
  }

  try {
    return {
      ...result,
      ...calculateInterestSavings({
        rows,
        result,
        newInterestAmount: storedResult.newInterestAmount,
        lastInterestAmount
      })
    };
  } catch {
    return {
      ...result,
      newInterestAmount: storedResult.newInterestAmount,
      totalInterestSaved: storedResult.totalInterestSaved
    };
  }
};

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
  const [firstUnpaidRowId, setFirstUnpaidRowId] = useLocalStorage<string | null>(
    STORAGE_KEYS.firstUnpaidRowId,
    null
  );
  const [recentResults, setRecentResults] = useLocalStorage<StoredCalculationResult[]>(
    STORAGE_KEYS.recentResults,
    []
  );
  const [amountDraft, setAmountDraft] = useLocalStorage<string>(STORAGE_KEYS.amountDraft, '');
  const [monthsDraft, setMonthsDraft] = useLocalStorage<string>(STORAGE_KEYS.monthsDraft, '');
  const [interestDraft, setInterestDraft] = useLocalStorage<string>(
    STORAGE_KEYS.interestDraft,
    ''
  );
  const [planningDraft, setPlanningDraft] = useLocalStorage<string>(
    STORAGE_KEYS.planningDraft,
    ''
  );
  const [planningResult, setPlanningResult] = useState<PlanningCalculationResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [monthsError, setMonthsError] = useState<string | null>(null);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);

  const sortedRows = useMemo(() => sortRows(rows), [rows]);

  const firstUnpaidInstallmentForSummary = useMemo(() => {
    if (!firstUnpaidRowId) {
      return null;
    }

    const paymentRows = principalRows(sortedRows);
    const index = paymentRows.findIndex((row) => row.id === firstUnpaidRowId);

    return index >= 0 ? index + 1 : null;
  }, [firstUnpaidRowId, sortedRows]);

  const recalculatedResults = useMemo(
    () =>
      recentResults.map((entry) => {
        try {
          const resultFirstUnpaidRowId = getResultFirstUnpaidRowId(entry.result, rows);

          if (!resultFirstUnpaidRowId) {
            return entry;
          }

          const result: CalculationResult =
            entry.result.type === 'amount'
              ? calculateByAmount({
                  rows,
                  firstUnpaidRowId: resultFirstUnpaidRowId,
                  amount: entry.inputValue
                })
              : calculateByMonths({
                  rows,
                  firstUnpaidRowId: resultFirstUnpaidRowId,
                  monthsToCover: entry.inputValue
                });

          return {
            ...entry,
            result: applyStoredInterestSavings(result, entry.result, rows, meta?.lastInterestAmount)
          };
        } catch {
          return entry;
        }
      }),
    [meta?.lastInterestAmount, recentResults, rows]
  );

  useEffect(() => {
    const paymentRows = sortedRows.filter(isPrincipalRow);
    const selectablePaymentRows = paymentRows.slice(1);

    if (!selectablePaymentRows.length) {
      setFirstUnpaidRowId(null);
      return;
    }

    const hasCurrentSelection =
      firstUnpaidRowId != null && selectablePaymentRows.some((row) => row.id === firstUnpaidRowId);

    if (!hasCurrentSelection) {
      setFirstUnpaidRowId(
        getLegacyFirstUnpaidRowId(paymentRows) ?? getDefaultFirstUnpaidRowId(paymentRows)
      );
    }
  }, [firstUnpaidRowId, setFirstUnpaidRowId, sortedRows]);

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

  useEffect(() => {
    setPlanningResult(null);
    setPlanningError(null);
  }, [recalculatedResults[0]?.id, recalculatedResults[0]?.result.remainingMonths]);

  const handleSelectPdf = async (file: File) => {
    setIsParsing(true);
    setAmountError(null);
    setMonthsError(null);
    setInterestError(null);
    setPlanningError(null);
    setPlanningResult(null);

    try {
      const { parseSchedulePdf } = await import('../services/pdfScheduleParser');
      const result = await parseSchedulePdf(file);
      setRows(result.rows);
      setWarnings(result.warnings);
      setMeta(result.meta);
      setFirstUnpaidRowId(getDefaultFirstUnpaidRowId(result.rows));
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
      const selectedRowId = firstUnpaidRowId;

      if (selectedRowId == null) {
        throw new Error('Please upload a PDF first.');
      }

      const result = calculateByAmount({
        rows,
        firstUnpaidRowId: selectedRowId,
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
      const selectedRowId = firstUnpaidRowId;

      if (selectedRowId == null) {
        throw new Error('Please upload a PDF first.');
      }

      const result = calculateByMonths({
        rows,
        firstUnpaidRowId: selectedRowId,
        monthsToCover: monthsToCover ?? 0
      });

      addResultToHistory(monthsToCover ?? 0, result);
    } catch (error) {
      setMonthsError(error instanceof Error ? error.message : 'Calculation failed.');
    }
  };

  const handleCalculateInterestSavings = () => {
    setInterestError(null);

    try {
      const newInterestAmount = parseFlexibleNumber(interestDraft);
      const latest = recalculatedResults[0];

      if (!latest) {
        throw new Error('Run a principal calculation first.');
      }

      const savings = calculateInterestSavings({
        rows,
        result: latest.result,
        newInterestAmount: newInterestAmount ?? 0,
        lastInterestAmount: meta?.lastInterestAmount
      });
      const updatedResult: CalculationResult = {
        ...latest.result,
        ...savings
      };

      setRecentResults((currentResults) =>
        currentResults.map((entry, index) =>
          index === 0 || entry.id === latest.id ? { ...entry, result: updatedResult } : entry
        )
      );
    } catch (error) {
      setInterestError(error instanceof Error ? error.message : 'Calculation failed.');
    }
  };

  const handleCalculatePlanning = () => {
    setPlanningError(null);

    try {
      const latest = recalculatedResults[0];

      if (!latest) {
        throw new Error('Run a principal calculation first.');
      }

      setPlanningResult(
        calculateMonthlyReimbursementPlanning({
          rows,
          result: latest.result,
          monthlyReimbursement: planningDraft
        })
      );
    } catch (error) {
      setPlanningResult(null);
      setPlanningError(error instanceof Error ? error.message : 'Calculation failed.');
    }
  };

  const handleExportJson = () => {
    downloadJson(
      {
        rows,
        firstUnpaidRowId,
        warnings,
        meta,
        recentResults: recalculatedResults
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
    setFirstUnpaidRowId(null);
    setRecentResults([]);
    setAmountDraft('');
    setMonthsDraft('');
    setInterestDraft('');
    setPlanningDraft('');
    setPlanningResult(null);
    setPlanningError(null);
  };

  return (
    <main className="app-shell">
      <header className="hero">
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
        firstUnpaidInstallment={firstUnpaidInstallmentForSummary}
        meta={meta}
      />

      <FirstUnpaidSelector
        title={uiText.firstUnpaidTitle}
        rows={sortedRows}
        value={firstUnpaidRowId}
        onChange={setFirstUnpaidRowId}
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
        <CalculationCard
          title={uiText.interestTitle}
          inputLabel="New interest amount"
          inputPlaceholder="e.g. 12000"
          value={interestDraft}
          helperText="Compares the new repayment schedule interest with the original interest read from the PDF."
          buttonLabel="Calculate"
          error={interestError}
          onValueChange={setInterestDraft}
          onSubmit={handleCalculateInterestSavings}
        />
      </div>

      <ResultsCard
        title={uiText.resultsTitle}
        results={recalculatedResults}
        planningDraft={planningDraft}
        planningResult={planningResult}
        planningError={planningError}
        onPlanningDraftChange={setPlanningDraft}
        onPlanningCalculate={handleCalculatePlanning}
      />

      <ScheduleEditor
        title={uiText.tableTitle}
        rows={sortedRows}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        onUpdateRow={handleUpdateRow}
        onSortRows={handleSortRows}
      />

      <HistoryCard title={uiText.historyTitle} results={recalculatedResults} />

      <StickyActions
        onExportJson={handleExportJson}
        onClearData={handleClearData}
        note={uiText.stickyNote}
      />
    </main>
  );
};
