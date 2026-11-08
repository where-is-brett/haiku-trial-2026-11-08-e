// src/lib/import.js
import { readStatement } from './statement.js';

// Stores the statement's rows, skipping any that match a stored row on date, description and cents.
// The whole file is read before anything is written, and the inserts share one transaction.
export function importStatement(db, text) {
  const rows = readStatement(text);
  const find = db.prepare(
    'SELECT 1 FROM transactions WHERE date = ? AND description = ? AND cents = ? LIMIT 1',
  );
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  let added = 0;
  let skipped = 0;
  db.exec('BEGIN');
  try {
    for (const row of rows) {
      if (find.get(row.date, row.description, row.cents)) {
        skipped++;
      } else {
        insert.run(row.date, row.description, row.cents);
        added++;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { added, skipped };
}
