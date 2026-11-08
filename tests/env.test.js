// tests/env.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';

test('PORT and LEDGER_DB are read from the environment', () => {
  assert.deepEqual(readConfig({ PORT: '8080', LEDGER_DB: ':memory:' }), {
    port: 8080,
    dbPath: ':memory:',
  });
});

test('without them the port is 3000 and the database is ledger.db', () => {
  assert.deepEqual(readConfig({}), { port: 3000, dbPath: 'ledger.db' });
});
