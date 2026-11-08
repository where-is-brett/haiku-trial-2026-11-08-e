// src/lib/ledger.js
import { DatabaseSync } from 'node:sqlite';

// Opens the ledger database at `path` (':memory:' is allowed) and makes sure the table exists.
export function openLedger(path) {
  const db = new DatabaseSync(path);
  db.exec(
    'CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)',
  );
  return db;
}
