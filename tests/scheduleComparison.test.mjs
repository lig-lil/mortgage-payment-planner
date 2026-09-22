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
  totalRemainingInterest: interest, finalScheduledPaymentDate: finalDate,
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
  assert.equal(a.remainingInterest, 10); // Only the selected unpaid portion.
  rows[0].creditAmount = 101;
  assert.equal(a.principalRemaining, 300); // Frozen derived snapshot.
  rows[0].creditAmount = 100;
});

test('A to B to C reports signed observed changes and calendar months', () => {
  const a = snapshot(rows, meta, 'a');
  const b = snapshot([{ ...rows[0], creditAmount: 90, interestAmount: 8 }], { ...meta, sourceFileName: 'B.pdf' }, 'a');
  const ab = compare(a, b);
  assert.equal(ab.principalDelta, -210);
  assert.equal(ab.interestDelta, -14);
  assert.equal(ab.termDifferenceMonths, -1);
  const c = snapshot([{ ...rows[1], paymentDate: '2036-01-15' }], { ...meta, sourceFileName: 'C.pdf' }, 'b');
  assert.equal(compare(b, c).previous.sourceFileName, 'B.pdf');
  assert.equal(compare(b, c).termDifferenceMonths, 6);
  assert.equal(compare(a, a).principalDelta, 0);
});

test('interest requires complete explicit finite data; zero is valid', () => {
  assert.equal(interest([{ ...rows[0], interestAmount: undefined }, rows[1]], 'a'), null);
  assert.equal(interest([{ ...rows[0], interestAmount: undefined }, rows[1]], 'b'), 10);
  for (const amount of [NaN, Infinity, -1]) assert.equal(interest([{ ...rows[0], interestAmount: amount }], 'a'), null);
  assert.equal(interest([{ ...rows[0], interestAmount: 0 }], 'a'), 0);
  assert.equal(interest(rows, 'missing'), null);
  assert.equal(compare(snapshot(rows, meta, 'a'), snapshot([{ ...rows[0], interestAmount: undefined }], meta, 'a')).interestDelta, null);
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
