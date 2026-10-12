import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Escapes keep the detector itself free of the corruption it detects.
const corruption = /\uFFFD|\u00e2\u20ac|\u00e2\u2020|\u00c2[\u0080-\u00bf]|\u00ef\u00bf\u00bd/;
const decoder = new TextDecoder('utf-8', { fatal: true });
const textFile = /\.(?:[cm]?[jt]sx?|css|html|md|json|svg)$/;
function maintainedFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? maintainedFiles(file) : textFile.test(file) ? [file] : [];
  });
}
test('maintained text is valid UTF-8 and contains no replacement characters or common mojibake', () => {
  const files = [...maintainedFiles('src'), ...maintainedFiles('tests'), ...maintainedFiles('public'),
    ...readdirSync('.').filter(file => /\.(?:md|html|json)$/.test(file) || file === 'vite.config.ts')];
  for (const file of files) {
    const text = decoder.decode(readFileSync(file));
    assert.equal(corruption.test(text), false, file + ': corrupted text');
  }
});
test('encoding detector catches representative corruption without rejecting ordinary question marks', () => {
  for (const text of ['\uFFFD', '\u00e2\u20ac\u201d', '\u00e2\u2020\u2019', '\u00c2\u00b7', '\u00ef\u00bf\u00bd']) assert.ok(corruption.test(text));
  assert.equal(corruption.test('Ready? value ?? fallback; optional?.field'), false);
});
