import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const output = mkdtempSync(join(tmpdir(), 'mortgage-domain-'));
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'src/utils/actualMortgage.ts', 'src/utils/loanDetails.ts', 'src/utils/scenarios.ts', 'src/utils/scheduleState.ts', 'src/utils/calculations.ts', '--outDir', output, '--module', 'commonjs', '--target', 'ES2021', '--skipLibCheck', '--strict']);
after(() => rmSync(output, { recursive: true, force: true }));
const require = createRequire(import.meta.url);
const load = name => require(join(output, 'utils', name + '.js'));
const { selectActualMortgage: actual, principalRepaid: repaid } = load('actualMortgage');
const { migrateLoanDetails: migrate, normalizeStartMonth } = load('loanDetails');
const { acceptSchedule } = load('scheduleState');
const { createScheduleReference: reference, scenarioReferenceStatus: status } = load('scenarios');
const { calculateByAmount: amount, calculateByMonths: months } = load('calculations');
const { createRealScheduleSnapshot: snapshot, compareRealSchedules: compare } = load('scheduleComparison');
const meta = { sourceFileName: 'A.pdf', extractedAt: '2026-10-01', parsedPages: 1, creditColumn: { confidence: 1 }, installmentColumn: { confidence: 1 } };
const rows = [
  { id: 'a', installmentNumber: 1, creditAmount: 100000, paymentDate: '2026-10-15' },
  { id: 'b', installmentNumber: 2, creditAmount: 180000, paymentDate: '2026-11-15' }
];
const confirmed = { originalLoanAmount: 350000, originalLoanAmountConfirmed: true };
test('missing and unverified amounts produce unavailable repayment metrics', () => {
  assert.equal(actual(rows, meta, 'b', migrate(null, null)).principalRepaid.percentage, null);
  const legacy = migrate(null, { ...meta, originalPrincipal: 350000 });
  assert.equal(legacy.originalLoanAmount, 350000);
  assert.equal(actual(rows, meta, 'b', legacy).principalRepaid.percentage, null);
});
test('confirmed 350000 minus actual 280000 is 70000 and 20%', () => {
  assert.deepEqual(actual(rows, meta, 'b', confirmed).principalRepaid, { amount: 70000, percentage: 20, reason: null });
});
test('invalid and inconsistent values are unavailable, never clamped', () => {
  for (const originalLoanAmount of [0, -1, NaN, Infinity, 200000]) assert.equal(repaid({ ...confirmed, originalLoanAmount }, 280000).percentage, null);
  for (const value of [null, -1, NaN, Infinity]) assert.equal(repaid(confirmed, value).percentage, null);
});
test('actual selector preserves principal interpretation, exposes unavailable fields and ignores simulations', () => {
  const before = actual(rows, meta, 'b', confirmed);
  const result = amount({ rows, firstUnpaidRowId: 'b', amount: 180000 });
  assert.equal(result.remainingCredit, 0);
  assert.deepEqual(actual(rows, meta, 'b', confirmed), before);
  assert.equal(before.outstandingPrincipal, 280000);
  assert.equal(before.installmentsRemaining, 1);
  assert.equal(before.nextInstallmentAmount, null);
  assert.equal(before.remainingInterest, null);
  assert.equal(actual([], null, null, confirmed).outstandingPrincipal, null);
  assert.equal(actual([{ ...rows[0], paymentDate: undefined }], meta, 'a', confirmed).lastScheduledPaymentDate, null);
});
const current = () => ({ rows: structuredClone(rows), meta, firstUnpaidRowId: 'b', previousScheduleSnapshot: null, loanDetails: confirmed });
test('valid upload preserves loan details and creates independent previous real snapshot', () => {
  const state = current();
  const next = acceptSchedule(state, { rows: [{ ...rows[1], id: 'new', creditAmount: 150000 }], meta: { ...meta, sourceFileName: 'B.pdf' }, warnings: [] }, 'new');
  assert.equal(next.loanDetails, confirmed);
  assert.equal(next.previousScheduleSnapshot.sourceFileName, 'A.pdf');
  state.rows[0].creditAmount = 1;
  assert.equal(next.previousScheduleSnapshot.installments[0].creditAmount, 100000);
});
test('invalid uploads do not alter active schedule, selection, details or previous snapshot', () => {
  const state = current(); state.previousScheduleSnapshot = snapshot(rows, meta, 'b');
  const before = structuredClone(state);
  for (const result of [{ rows: [], warnings: [], meta }, { rows, warnings: [{ severity: 'error' }], meta }, { rows: [{ ...rows[0], creditAmount: -1 }], warnings: [], meta }]) assert.throws(() => acceptSchedule(state, result, null));
  assert.deepEqual(state, before);
});
test('migration is idempotent and retains all legacy metadata without replacing confirmed details', () => {
  const legacyMeta = { ...meta, originalPrincipal: 350000, contractedYear: '2020', contractedPeriod: 'Jan 2020' };
  const migrated = migrate(null, legacyMeta);
  assert.equal(migrated.originalLoanAmountConfirmed, false);
  assert.equal(migrated.startMonth, '2020-01');
  assert.equal(migrated.legacy.contractedYear, '2020');
  assert.equal(migrate(migrated, { ...meta, originalPrincipal: 1 }), migrated);
  assert.equal(migrate(confirmed, legacyMeta), confirmed);
  assert.equal(migrate(null, { ...legacyMeta, originalPrincipalLocked: true }).originalLoanAmountConfirmed, true);
  assert.equal(normalizeStartMonth('2020'), undefined);
});
test('saved history remains accessible; references detect uploads and corrections; legacy stays unknown', () => {
  const result = months({ rows, firstUnpaidRowId: 'b', monthsToCover: 1 });
  const legacy = { id: 'legacy', createdAt: '2020-01-01', inputValue: 1, result };
  const saved = { ...legacy, id: 'new', referenceSchedule: reference(rows, meta) };
  const history = JSON.parse(JSON.stringify([legacy, saved]));
  assert.deepEqual(history[0], legacy);
  assert.equal(status(history[0], reference(rows, meta)), 'legacy-unknown');
  assert.equal(status(history[1], reference(rows, meta)), 'current');
  assert.equal(status(saved, reference(rows, { ...meta, sourceFileName: 'B.pdf' })), 'different');
  assert.equal(status(saved, reference([{ ...rows[0], creditAmount: 1 }, rows[1]], meta)), 'different');
});
test('amount and months calculations retain known unchanged-input results', () => {
  const payments = [100, 200, 300].map((creditAmount, i) => ({ id: String(i), installmentNumber: i + 1, creditAmount }));
  const a = amount({ rows: payments, firstUnpaidRowId: '1', amount: 250 });
  const m = months({ rows: payments, firstUnpaidRowId: '1', monthsToCover: 1 });
  assert.equal(a.totalCreditCovered, 200); assert.equal(a.unusedAmount, 50); assert.equal(a.remainingCredit, 250); assert.equal(a.monthsCovered, 1);
  assert.equal(m.totalAmountRequired, 200); assert.equal(m.remainingCredit, 300); assert.equal(m.monthsRequested, 1);
});
test('observed interest deltas need complete real data and allow increases', () => {
  const payments = rows.map(row => ({ ...row, interestAmount: 10 }));
  const before = snapshot(payments, meta, 'a');
  const after = snapshot(payments.map(row => ({ ...row, interestAmount: 20 })), meta, 'a');
  assert.equal(compare(before, after).remainingInterestDelta, 20);
  assert.equal(compare(snapshot(rows, meta, 'a'), after).remainingInterestDelta, null);
  const metrics = actual(payments, meta, 'a', confirmed);
  assert.equal(metrics.remainingInterest, 20); assert.equal(metrics.nextInstallmentAmount, 100010);
  assert.equal(metrics.totalRemainingScheduledPayments, 280020);
});
