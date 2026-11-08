// tests/home.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHandler } from '../src/app.js';
import { openLedger } from '../src/lib/ledger.js';
import { importStatement } from '../src/lib/import.js';
import { request } from './http-helpers.js';

const sample = fs.readFileSync(new URL('../data/sample-statement.csv', import.meta.url), 'utf8');

test('an empty ledger says nothing is imported and lists no months', async () => {
  const res = await request(createHandler(openLedger(':memory:')), { path: '/' });
  assert.equal(res.status, 200);
  assert.ok(res.body.includes('Nothing imported yet'));
  assert.ok(!res.body.includes('/month?m='));
});

test('the home page lists months newest first, each linking to its month', async () => {
  const db = openLedger(':memory:');
  importStatement(db, sample);
  const res = await request(createHandler(db), { path: '/' });
  const oct = res.body.indexOf('href="/month?m=2026-10"');
  const sep = res.body.indexOf('href="/month?m=2026-09"');
  const aug = res.body.indexOf('href="/month?m=2026-08"');
  assert.ok(oct > -1 && sep > -1 && aug > -1);
  assert.ok(oct < sep && sep < aug);
  assert.ok(!res.body.includes('2026-07'));
});
