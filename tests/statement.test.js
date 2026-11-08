// tests/statement.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readStatement, NotAStatementError } from '../src/lib/statement.js';

const sample = fs.readFileSync(new URL('../data/sample-statement.csv', import.meta.url), 'utf8');
const HEADER = 'Date,Description,Amount';

test('the sample statement reads one entry per data line', () => {
  const dataLines = sample.split(/\r?\n/).slice(1).filter((line) => line.trim() !== '');
  assert.equal(readStatement(sample).length, dataLines.length);
});

test('the first sample row is read as date, description and cents', () => {
  assert.deepEqual(readStatement(sample)[0], {
    date: '2026-08-02',
    description: 'Skyline Broadband REF 0617',
    cents: 858,
  });
});

test('a comma inside quotes stays in the description', () => {
  const rows = readStatement(`${HEADER}\n06/08/2026,"Pasta, Pizza & Co REF 3946",102.29`);
  assert.deepEqual(rows, [{ date: '2026-08-06', description: 'Pasta, Pizza & Co REF 3946', cents: 10229 }]);
});

test('a quote in the middle of a field is an ordinary character', () => {
  const rows = readStatement(`${HEADER}\n06/08/2026,Tom "Bob" Smith,10.00\n05/08/2026,5" Pipe Co,10.00`);
  assert.deepEqual(rows.map((row) => row.description), ['Tom "Bob" Smith', '5" Pipe Co']);
});

test('a thousands separator inside quotes is read as cents', () => {
  const rows = readStatement(`${HEADER}\n05/08/2026,Rent,"1,234.50"`);
  assert.equal(rows[0].cents, 123450);
});

test('a bracketed amount is money coming back', () => {
  const rows = readStatement(`${HEADER}\n15/09/2026,Marlowe Homewares REFUND,(40.00)`);
  assert.equal(rows[0].cents, -4000);
});

test('CRLF line endings, a leading byte-order mark and trailing blank lines read the same', () => {
  const lf = readStatement(`${HEADER}\n03/08/2026,Kestrel Coffee Bar,6.50\n`);
  const messy = readStatement(`﻿${HEADER}\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n\r\n\r\n`);
  assert.deepEqual(messy, lf);
});

test('a header-only file reads as no rows', () => {
  assert.deepEqual(readStatement(`${HEADER}\n`), []);
});

for (const [label, text] of [
  ['a wrong header', 'Date,Payee,Amount\n03/08/2026,Kestrel Coffee Bar,6.50'],
  ['a dashed date', `${HEADER}\n31-08-2026,x,1.00`],
  ['an impossible date', `${HEADER}\n32/13/2026,x,1.00`],
  ['a day past the end of the month', `${HEADER}\n31/02/2026,x,1.00`],
  ['a text amount', `${HEADER}\n01/08/2026,x,abc`],
  ['a decimal comma in quotes', `${HEADER}\n03/08/2026,x,"6,50"`],
  ['an unclosed bracket', `${HEADER}\n15/09/2026,x,(40.00`],
  ['a row with two fields', `${HEADER}\n01/08/2026,x`],
  ['an empty file', ''],
  ['plain text', 'hello world'],
]) {
  test(`${label} is not a statement`, () => {
    assert.throws(() => readStatement(text), NotAStatementError);
  });
}
