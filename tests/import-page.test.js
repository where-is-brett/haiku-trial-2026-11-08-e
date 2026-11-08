// tests/import-page.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHandler } from '../src/app.js';
import { openLedger } from '../src/lib/ledger.js';
import { NOT_A_STATEMENT } from '../src/lib/statement.js';
import { request, multipartRequest, statementForm } from './http-helpers.js';

const sample = fs.readFileSync(new URL('../data/sample-statement.csv', import.meta.url), 'utf8');
const count = (db) => db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;

test('GET /import shows a multipart form with a statement file field', async () => {
  const handler = createHandler(openLedger(':memory:'));
  const res = await request(handler, { path: '/import' });
  assert.equal(res.status, 200);
  assert.match(res.body, /enctype="multipart\/form-data"/);
  assert.match(res.body, /<input type="file" name="statement"/);
});

test('uploading the sample reports the counts, and uploading it again skips every row', async () => {
  const db = openLedger(':memory:');
  const handler = createHandler(db);

  const first = await multipartRequest(handler, '/import', statementForm(sample));
  assert.equal(first.status, 200);
  assert.ok(first.body.includes('<p>Added 128, skipped 0</p>'));

  const second = await multipartRequest(handler, '/import', statementForm(sample));
  assert.ok(second.body.includes('<p>Added 0, skipped 128</p>'));
  assert.equal(count(db), 128);
});

test('a file that is not a statement gets a plain error and stores nothing', async () => {
  const db = openLedger(':memory:');
  const res = await multipartRequest(createHandler(db), '/import', statementForm('hello world'));
  assert.equal(res.status, 400);
  assert.ok(res.body.includes(`<p>${NOT_A_STATEMENT}</p>`));
  assert.equal(count(db), 0);
});

test('a file with a good row and then a bad row stores nothing from that upload', async () => {
  const db = openLedger(':memory:');
  const handler = createHandler(db);
  await multipartRequest(handler, '/import', statementForm(sample));
  const mixed = 'Date,Description,Amount\n03/08/2026,New Shop,6.50\n31-08-2026,x,1.00';
  const res = await multipartRequest(handler, '/import', statementForm(mixed));
  assert.equal(res.status, 400);
  assert.equal(count(db), 128);
});

test('a request with no statement file gets the same plain error', async () => {
  const res = await multipartRequest(
    createHandler(openLedger(':memory:')),
    '/import',
    statementForm('ignored', 'other'),
  );
  assert.equal(res.status, 400);
  assert.ok(res.body.includes(`<p>${NOT_A_STATEMENT}</p>`));
});

test('a POST that is not multipart gets the same plain error', async () => {
  const res = await request(createHandler(openLedger(':memory:')), {
    method: 'POST',
    path: '/import',
    headers: { 'content-type': 'text/plain' },
    body: Buffer.from('hello world'),
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.includes(`<p>${NOT_A_STATEMENT}</p>`));
});
