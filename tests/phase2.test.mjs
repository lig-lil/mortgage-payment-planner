import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// Local temporary output allows compiled React components to resolve existing dependencies.
const output = mkdtempSync(join(process.cwd(), '.phase2-tests-'));
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'src/utils/installmentBoundaries.ts', 'src/utils/loanDetailsEditor.ts', 'src/utils/calculations.ts', 'src/utils/actualMortgage.ts', 'src/utils/scheduleState.ts', 'src/components/Dashboard.tsx', '--outDir', output, '--module', 'commonjs', '--target', 'ES2021', '--skipLibCheck', '--strict', '--jsx', 'react-jsx', '--esModuleInterop']);
after(() => rmSync(output, { recursive: true, force: true }));
writeFileSync(join(output, 'package.json'), JSON.stringify({ type: 'commonjs' }));
const require = createRequire(import.meta.url);
const load = name => require(join(output, 'utils', name + '.js'));
const { initializeBoundaries, createActualScheduleSnapshot, compareActualSchedules } = load('installmentBoundaries');
const { saveLoanDetails } = load('loanDetailsEditor');
const { selectActualMortgage } = load('actualMortgage');
const { calculateByMonths, calculateByAmount } = load('calculations');
const { createRealScheduleSnapshot } = load('scheduleComparison');
const { acceptSchedule } = load('scheduleState');
const { createScheduleReference, scenarioReferenceStatus } = load('scenarios');
const { Dashboard } = require(join(output, 'components/Dashboard.js'));
const meta = { sourceFileName: 'bank-A.pdf', extractedAt: '2026-09-30T10:00:00Z', parsedPages: 1, creditColumn: { confidence: 1 }, installmentColumn: { confidence: 1 } };
const rows = [100, 200, 300, 400].map((creditAmount, index) => ({ id: 'row-' + (index + 1), installmentNumber: index + 1, creditAmount, interestAmount: [40, 30, 20, 10][index], paymentDate: ['2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15'][index] }));
const details = { originalLoanAmount: 2000, originalLoanAmountConfirmed: true, startMonth: '2020-02' };
test('legacy Planner #2 stays scenario-only; initial actual boundary starts at first eligible row', () => {
  assert.deepEqual(initializeBoundaries(rows, null, 'row-2'), { actualFirstUnpaidRowId: 'row-1', scenarioStartingRowId: 'row-2' });
  assert.deepEqual(initializeBoundaries(rows, 'row-2', 'row-3'), { actualFirstUnpaidRowId: 'row-2', scenarioStartingRowId: 'row-3' });
});
test('changing Scenario selector preserves Actual principal, interest and installment count', () => {
  const before = initializeBoundaries(rows, 'row-1', 'row-2');
  const after = initializeBoundaries(rows, before.actualFirstUnpaidRowId, 'row-3');
  assert.deepEqual(selectActualMortgage(rows, meta, before.actualFirstUnpaidRowId, details), selectActualMortgage(rows, meta, after.actualFirstUnpaidRowId, details));
});
test('actual Remaining Interest includes October, irrespective of November scenario start', () => {
  const boundaries = initializeBoundaries(rows, null, 'row-2');
  const actual = selectActualMortgage(rows, meta, boundaries.actualFirstUnpaidRowId, details);
  assert.equal(actual.remainingInterest, 100); assert.equal(actual.installmentsRemaining, 4);
  assert.equal(actual.nextInstallmentDate, '2026-10-15'); assert.equal(actual.nextInterest, 40);
});
test('amount and months extra principal begins at selected #3, with no additional skip', () => {
  const payments = rows.map(({ interestAmount, ...row }) => row); // Existing deterministic row-summing fallback.
  const months = calculateByMonths({ rows: payments, firstUnpaidRowId: 'row-3', monthsToCover: 1 });
  const amount = calculateByAmount({ rows: payments, firstUnpaidRowId: 'row-3', amount: 300 });
  assert.equal(months.firstUnpaidRowId, 'row-3'); assert.equal(months.totalAmountRequired, 300);
  assert.deepEqual(months.installmentNumbersCovered, [3]); assert.deepEqual(amount.installmentNumbersCovered, [3]);
});
test('reload validates selections independently; uploads preserve valid manual scenario identity', () => {
  const persisted = JSON.parse(JSON.stringify({ actual: 'row-1', scenario: 'row-3' }));
  assert.equal(initializeBoundaries(rows, persisted.actual, persisted.scenario).scenarioStartingRowId, 'row-3');
  assert.equal(initializeBoundaries(rows.slice(1), persisted.actual, persisted.scenario).actualFirstUnpaidRowId, 'row-2');
  assert.deepEqual(initializeBoundaries(rows.map(row => ({ ...row, id: 'new-' + row.id })), persisted.actual, persisted.scenario), { actualFirstUnpaidRowId: 'new-row-1', scenarioStartingRowId: 'new-row-2' });
  assert.deepEqual(initializeBoundaries([], persisted.actual, persisted.scenario), { actualFirstUnpaidRowId: null, scenarioStartingRowId: null });
});
test('Loan Details save confirms, validates and persists independently of schedule replacement', () => {
  const saved = saveLoanDetails({ ...details, originalLoanAmountConfirmed: false }, '2,000.00', '2020-02');
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), details);
  for (const amount of ['bad', '0', '-10', '12oops', '1..2', '12,34,56']) assert.throws(() => saveLoanDetails(details, amount, '2020-02'));
  for (const month of ['2020-13', '2020', '0000-01']) assert.throws(() => saveLoanDetails(details, '2000', month));
  assert.equal(saveLoanDetails(details, '', '').originalLoanAmountConfirmed, false);
  const current = { rows, meta, firstUnpaidRowId: 'row-1', previousScheduleSnapshot: null, loanDetails: saved };
  const next = acceptSchedule(current, { rows: rows.slice(1), meta: { ...meta, sourceFileName: 'bank-B.pdf' }, warnings: [] }, 'row-2');
  assert.equal(next.loanDetails, saved); assert.deepEqual(current.rows, rows);
});
test('new observed snapshots count Actual unpaid rows and detach from later manual edits', () => {
  const source = structuredClone(rows);
  const previous = createActualScheduleSnapshot(source, meta, 'row-2');
  const current = createActualScheduleSnapshot(rows.slice(2), { ...meta, sourceFileName: 'bank-B.pdf' }, 'row-3');
  assert.equal(previous.installmentsRemaining, 3); assert.equal(previous.remainingInterest, 60);
  assert.equal(compareActualSchedules(previous, current).installmentsDelta, -1);
  source[1].interestAmount = 999;
  assert.equal(previous.installments[1].interestAmount, 30);
});
test('legacy snapshots retain values without inventing Actual payment status', () => {
  const legacy = createRealScheduleSnapshot(rows, meta, 'row-2');
  const before = structuredClone(legacy);
  const compared = compareActualSchedules(legacy, createActualScheduleSnapshot(rows, meta, 'row-1'));
  assert.equal(compared.installmentsDelta, null); assert.equal(compared.remainingInterestDelta, null); assert.equal(compared.estimatedInterestSaved, null);
  assert.deepEqual(legacy, before); assert.equal(compared.principalDelta, 0);
});
test('saved scenario remains on original schedule, including legacy history accessibility', () => {
  const stored = { id: 'old', createdAt: '2026-09-30', inputValue: 300, referenceSchedule: createScheduleReference(rows, meta), result: calculateByAmount({ rows, firstUnpaidRowId: 'row-3', amount: 300 }) };
  const history = JSON.parse(JSON.stringify([stored, { ...stored, id: 'legacy', referenceSchedule: undefined }]));
  assert.equal(scenarioReferenceStatus(history[0], createScheduleReference(rows, { ...meta, sourceFileName: 'new.pdf' })), 'different');
  assert.equal(scenarioReferenceStatus(history[1], createScheduleReference(rows, meta)), 'legacy-unknown'); assert.deepEqual(history[0].result, stored.result);
});
const dashboard = (actual, loanDetails = details, results = []) => renderToStaticMarkup(React.createElement(Dashboard, { actualMortgage: actual, loanDetails, scheduleComparison: null, meta, results, onOpenPlanner() {}, onOpenSchedule() {}, onSaveLoanDetails() {} }));
test('Overview without confirmed details has Add loan details and no misleading progress bar', () => {
  const unconfirmed = { ...details, originalLoanAmountConfirmed: false };
  const html = dashboard(selectActualMortgage(rows, meta, 'row-1', unconfirmed), unconfirmed);
  assert.ok(html.includes('Add loan details')); assert.ok(!html.includes('role="progressbar"'));
  assert.ok(html.indexOf('Current mortgage') < html.indexOf('Changes since previous schedule'));
  assert.ok(html.indexOf('Changes since previous schedule') < html.indexOf('Latest scenario'));
});
test('Overview displays bank metrics and stored scenario reference separately; latest uses creation date', () => {
  const actual = selectActualMortgage(rows, meta, 'row-1', details);
  const latest = { id: 'new', createdAt: '2026-10-05', inputValue: 300, result: calculateByAmount({ rows, firstUnpaidRowId: 'row-3', amount: 300 }), referenceSchedule: createScheduleReference(rows, { ...meta, sourceFileName: 'original.pdf' }) };
  const older = { ...latest, id: 'old', createdAt: '2026-10-01', referenceSchedule: undefined };
  const html = dashboard(actual, details, [older, latest]);
  assert.ok(html.includes('1,000.00 RON')); assert.ok(html.includes('100.00 RON')); assert.ok(html.includes('original.pdf'));
  assert.ok(html.includes('50.0%')); assert.ok(html.includes('aria-valuenow="50"'));
  assert.ok(!html.includes('Legacy scenario: reference schedule unknown'));
  const empty = dashboard(selectActualMortgage([], null, null, details)); assert.ok(empty.includes('No schedule uploaded'));
});

const { ron, scheduledDate } = load('overviewFormatting');
const { ScheduleChangesCard } = require(join(output, 'components/ScheduleChangesCard.js'));
const { LoanDetailsDialog } = require(join(output, 'components/LoanDetailsDialog.js'));
test('Overview preserves contextual separators, navigation chevrons and unavailable financial values', () => {
  const html = dashboard(selectActualMortgage(rows, meta, 'row-1', details));
  assert.ok(html.includes('Actual · bank schedule'));
  assert.ok(html.includes('Next installment · 15 Oct 2026'));
  assert.ok(html.includes('>View schedule</button>'));
  assert.ok(html.includes('Create a scenario ›'));
  const latest = { id: 'unicode', createdAt: '2026-10-05', inputValue: 300, result: calculateByAmount({ rows, firstUnpaidRowId: 'row-3', amount: 300 }) };
  const saved = dashboard(selectActualMortgage(rows, meta, 'row-1', details), details, [latest]);
  assert.ok(saved.includes('Open Scenarios ›'));
  assert.ok(saved.includes('<dt>Estimated interest saved</dt><dd>—</dd>'));
  for (const value of [null, undefined, NaN, Infinity]) assert.equal(ron(value), '—');
  assert.equal(ron(0), '0.00 RON');
  assert.equal(scheduledDate(null), '—');
  const empty = dashboard(selectActualMortgage([], null, null, details));
  assert.ok(empty.includes('<dt>Installments left</dt><dd>—</dd>'));
  const dialog = renderToStaticMarkup(React.createElement(LoanDetailsDialog, { details, meta, onSave() {}, onClose() {} }));
  assert.ok(dialog.includes('>×</button>'));
});
test('observed transitions use arrows and only the aligned estimate uses approximation', () => {
  const previous = createActualScheduleSnapshot(rows, meta, 'row-1');
  const current = createActualScheduleSnapshot(rows, { ...meta, sourceFileName: 'bank-B.pdf' }, 'row-1');
  const comparison = { ...compareActualSchedules(previous, current), estimatedInterestSaved: { amount: 12 } };
  const html = renderToStaticMarkup(React.createElement(ScheduleChangesCard, { comparison }));
  assert.ok(html.includes('bank-A.pdf → bank-B.pdf'));
  assert.ok(html.includes('1,000.00 RON → 1,000.00 RON'));
  assert.ok(html.includes('4 → 4'));
  assert.ok(html.includes('Aligned interest reduction estimate ≈ 12.00 RON'));
});

test('Outcome reference timestamp uses yyyy-mm-dd hh:mm:ss while preserving UTC time', () => {
  const { formatReferenceTimestamp, scenarioReferenceLabel } = load('scenarios');
  const entry = { referenceSchedule: { sourceFileName: 'bank.pdf', extractedAt: '2026-10-12T19:09:14.707Z' } };
  assert.equal(scenarioReferenceLabel(entry, formatReferenceTimestamp), 'Saved against bank.pdf (2026-10-12 19:09:14)');
  assert.equal(formatReferenceTimestamp('invalid'), 'date unavailable');
  assert.equal(scenarioReferenceLabel({ referenceSchedule: { sourceFileName: 'bank.pdf', extractedAt: null } }, formatReferenceTimestamp), 'Saved against bank.pdf (date unavailable)');
});
