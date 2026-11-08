// tests/import.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openLedger } from '../src/lib/ledger.js';
import { importStatement } from '../src/lib/import.js';
import { NotAStatementError } from '../src/lib/statement.js';

const sample = fs.readFileSync(new URL('../data/sample-statement.csv', import.meta.url), 'utf8');
const HEADER = 'Date,Description,Amount';
const count = (db) => db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;

test('importing the sample stores every row', () => {
  const db = openLedger(':memory:');
  const rows = sample.split(/\r?\n/).slice(1).filter((line) => line.trim() !== '').length;
  assert.deepEqual(importStatement(db, sample), { added: rows, skipped: 0 });
  assert.equal(count(db), rows);
});

test('importing the same file again skips every row', () => {
  const db = openLedger(':memory:');
  const rows = importStatement(db, sample).added;
  assert.deepEqual(importStatement(db, sample), { added: 0, skipped: rows });
  assert.equal(count(db), rows);
});

test('an identical line twice in one file is stored once', () => {
  const db = openLedger(':memory:');
  const text = `${HEADER}\n03/08/2026,Kestrel Coffee Bar,6.50\n03/08/2026,Kestrel Coffee Bar,6.50`;
  assert.deepEqual(importStatement(db, text), { added: 1, skipped: 1 });
  assert.equal(count(db), 1);
});

test('a file with a bad row after good rows stores nothing', () => {
  const db = openLedger(':memory:');
  const text = `${HEADER}\n03/08/2026,Kestrel Coffee Bar,6.50\n31-08-2026,x,1.00`;
  assert.throws(() => importStatement(db, text), NotAStatementError);
  assert.equal(count(db), 0);
});
