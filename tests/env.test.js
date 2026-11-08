// tests/env.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../src/config.js';
import { openLedger } from '../src/lib/ledger.js';

const serverPath = fileURLToPath(new URL('../src/server.js', import.meta.url));

test('PORT and LEDGER_DB are read from the environment', () => {
  assert.deepEqual(readConfig({ PORT: '8080', LEDGER_DB: ':memory:' }), {
    port: 8080,
    dbPath: ':memory:',
  });
});

test('without them the port is 3000 and the database is ledger.db', () => {
  assert.deepEqual(readConfig({}), { port: 3000, dbPath: 'ledger.db' });
});

// Asks the OS for a free local port, then releases it.
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// Starts src/server.js with the given environment and resolves once it reports its port.
// A child that exits first rejects with the Node error code it printed, if it printed one.
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
    child.on('exit', (code) => {
      const error = new Error(`server exited with ${code}: ${err}`);
      error.code = /code: '(\w+)'/.exec(err)?.[1];
      reject(error);
    });
  });
}

test('server.js listens on PORT and opens the database at LEDGER_DB', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  const dbFile = path.join(dir, 'ledger.db');
  let server;
  let port;
  for (let attempt = 1; ; attempt++) {
    try {
      port = await freePort();
      server = await startServer({ PORT: String(port), LEDGER_DB: dbFile });
      break;
    } catch (error) {
      // Another process can take the port between freePort() and the child's bind; try a new one.
      if (error.code === 'EADDRINUSE' && attempt < 3) continue;
      fs.rmSync(dir, { recursive: true, force: true });
      if (error.code === 'EPERM') {
        t.skip('local port binding is refused in this sandbox');
        return;
      }
      throw error;
    }
  }
  try {
    assert.equal(server.port, port, 'server listened on the PORT it was given');
    assert.ok(fs.existsSync(dbFile), 'server created the database at LEDGER_DB');
    const res = await fetch(`http://127.0.0.1:${port}/`);
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
