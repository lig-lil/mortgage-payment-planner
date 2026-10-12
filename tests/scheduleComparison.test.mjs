import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const output = mkdtempSync(join(tmpdir(), 'mortgage-comparison-'));
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'src/utils/scheduleComparison.ts',
  '--outDir', output, '--module', 'commonjs', '--target', 'ES2021', '--skipLibCheck', '--strict']);
after(() => rmSync(output, { recursive: true, force: true }));
const require = createRequire(import.meta.url);
const { createRealScheduleSnapshot: snapshot, compareRealSchedules: compare,
  estimateInterestSaved: estimate, finalScheduledPaymentDate: finalDate,
  isAcceptablePdfSchedule: valid } = require(join(output, 'utils/scheduleComparison.js'));
const meta = { sourceFileName: 'A.pdf', extractedAt: '2026-09-22T12:00:00Z', parsedPages: 1,
  creditColumn: { confidence: 1 }, installmentColumn: { confidence: 1 } };
const rows = [
  { id: 'a', installmentNumber: 1, creditAmount: 100, interestAmount: 12, paymentDate: '2035-07-15' },
  { id: 'b', installmentNumber: 2, creditAmount: 200, interestAmount: 10, paymentDate: '2035-08-15' }
];

test('first upload has no comparison; snapshot round-trips through localStorage JSON', () => {
  const a = snapshot(rows, meta, 'b');
  assert.equal(compare(null, a), null);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.equal(a.principalRemaining, 300); // Same full-row sum as Current Mortgage.
  assert.equal(a.installmentsRemaining, 2);
  assert.equal(a.installments[1].interestAmount, 10);
  rows[0].creditAmount = 101;
  assert.equal(a.principalRemaining, 300); // Frozen derived snapshot.
  rows[0].creditAmount = 100;
});

test('A to B to C reports signed observed changes and calendar months', () => {
  const a = snapshot(rows, meta, 'a');
  const b = snapshot([{ ...rows[0], creditAmount: 90, interestAmount: 8 }], { ...meta, sourceFileName: 'B.pdf' }, 'a');
  const ab = compare(a, b);
  assert.equal(ab.principalDelta, -210);
  assert.equal(ab.installmentsDelta, -1);
  assert.equal(ab.estimatedInterestSaved.amount, 14);
  assert.equal(ab.termDifferenceMonths, -1);
  const c = snapshot([{ ...rows[1], paymentDate: '2036-01-15' }], { ...meta, sourceFileName: 'C.pdf' }, 'b');
  assert.equal(compare(b, c).previous.sourceFileName, 'B.pdf');
  assert.equal(compare(b, c).termDifferenceMonths, 6);
  assert.equal(compare(a, a).principalDelta, 0);
});

const schedule = (values, start = values[0]?.id) => snapshot(values, meta, start);
const timeline = [10, 9, 8, 7, 6, 5].map((interestAmount, index) => ({
  id: 'month-' + index, installmentNumber: index + 10, creditAmount: 100, interestAmount,
  paymentDate: ['2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15', '2027-03-15'][index]
}));

test('A: no previous PDF makes estimate unavailable', () => {
  assert.equal(estimate(null, schedule(timeline)), null);
});
test('B: normal payment excludes the paid month even when its interest is missing', () => {
  const before = timeline.map((r, i) => i === 0 ? { ...r, interestAmount: undefined } : r);
  assert.equal(estimate(schedule(before), schedule(timeline.slice(1))).amount, 0);
});
test('C: payment plus early repayment aligns by date even with renumbered rows', () => {
  const current = timeline.slice(1, 4).map((r, i) => ({ ...r, installmentNumber: i + 1, interestAmount: r.interestAmount - 1 }));
  assert.equal(estimate(schedule(timeline), schedule(current)).amount, 14);
});
test('D: several elapsed months and a selected unpaid start exclude all earlier interest', () => {
  const result = estimate(schedule(timeline), schedule(timeline.slice(2), 'month-3'));
  assert.equal(result.amount, 0);
  assert.equal(result.startDate, '2027-01-15');
});
test('missing interest, negative savings, unmatched dates and legacy snapshots are unavailable', () => {
  for (const interestAmount of [undefined, NaN, Infinity, -1]) {
    assert.equal(estimate(schedule(timeline), schedule([{ ...timeline[3], interestAmount }])), null);
  }
  assert.equal(estimate(schedule(timeline), schedule([{ ...timeline[3], interestAmount: 100 }])), null);
  assert.equal(estimate(schedule(timeline), schedule([{ ...timeline[3], paymentDate: '2028-01-15' }])), null);
  assert.equal(estimate({ ...schedule(timeline), installments: undefined }, schedule(timeline)), null);
  assert.equal(estimate(schedule(timeline), schedule(timeline, 'missing')), null);
});
test('number fallback requires dated corroboration and rejects inconsistent numbering', () => {
  const current = timeline.slice(3).map((r, i) => i === 0 ? { ...r, paymentDate: undefined } : r);
  assert.equal(estimate(schedule(timeline), schedule(current)).amount, 0);
  assert.equal(estimate(schedule(timeline), schedule(current.map(r => ({ ...r, paymentDate: undefined })))), null);
  assert.equal(estimate(schedule(timeline), schedule(current.map((r, i) => i === 1 ? { ...r, installmentNumber: 50 } : r))), null);
});
test('duplicate dates/numbers rejected; zero interest valid; fees excluded; cents preserved', () => {
  assert.equal(estimate(schedule(timeline), schedule([timeline[3], timeline[3]])), null);
  assert.equal(estimate(schedule(timeline), schedule([timeline[3], { ...timeline[4], paymentDate: timeline[3].paymentDate }])), null);
  const current = [{ ...timeline[3], interestAmount: 0 }, { id: 'fee', installmentNumber: 99, creditAmount: 0 }];
  assert.equal(estimate(schedule(timeline), schedule(current)).amount, 18);
  assert.equal(estimate(schedule([{ ...timeline[3], interestAmount: 10.23 }]), schedule([{ ...timeline[3], interestAmount: 8.12 }])).amount, 2.11);
});

test('final date ignores fees and invalid dates and supports legacy raw dates', () => {
  assert.equal(finalDate([...rows, { id: 'fee', installmentNumber: 3, creditAmount: 0, paymentDate: '2040-01-01' }]), '2035-08-15');
  assert.equal(finalDate([{ ...rows[0], paymentDate: '2035-02-30' }]), null);
  assert.equal(finalDate([{ ...rows[0], paymentDate: undefined, rawRowData: { date: '15 Aug 2035' } }]), '2035-08-15');
});

test('invalid parses cannot pass the replacement gate', () => {
  const result = { rows, warnings: [], meta };
  assert.equal(valid(result), true);
  assert.equal(valid({ ...result, rows: [] }), false);
  assert.equal(valid({ ...result, rows: [rows[0], rows[0]] }), false);
  assert.equal(valid({ ...result, warnings: [{ severity: 'error' }] }), false);
  assert.equal(valid({ ...result, rows: [{ ...rows[0], creditAmount: Infinity }] }), false);
});
