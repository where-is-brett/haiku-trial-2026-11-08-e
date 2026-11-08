// tests/env.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readConfig } from '../src/config.js';
import { openLedger } from '../src/lib/ledger.js';

const serverPath = new URL('../src/server.js', import.meta.url).pathname;

test('PORT and LEDGER_DB are read from the environment', () => {
  assert.deepEqual(readConfig({ PORT: '8080', LEDGER_DB: ':memory:' }), {
    port: 8080,
    dbPath: ':memory:',
  });
});

test('without them the port is 3000 and the database is ledger.db', () => {
  assert.deepEqual(readConfig({}), { port: 3000, dbPath: 'ledger.db' });
});

// Starts src/server.js with the given environment and resolves once it reports its port.
function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], { env: { ...process.env, ...env } });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const match = /listening on (\d+)/.exec(out);
      if (match) resolve({ child, port: Number(match[1]) });
    });
    child.stderr.on('data', (chunk) => {
      err += chunk;
    });
    child.on('exit', (code) => reject(new Error(`server exited with ${code}: ${err}`)));
  });
}

test('server.js listens on PORT and opens the database at LEDGER_DB', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  const dbFile = path.join(dir, 'ledger.db');
  let server;
  try {
    server = await startServer({ PORT: '0', LEDGER_DB: dbFile });
  } catch (error) {
    if (/EPERM/.test(error.message)) {
      t.skip('local port binding is refused in this sandbox');
      return;
    }
    throw error;
  }
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.equal(res.status, 200);
    const db = openLedger(dbFile);
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transactions'").get();
    assert.ok(table);
    db.close();
  } finally {
    server.child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
