<!-- README.md -->
# Spending tracker

A small web app that reads a bank statement and shows where the money went.
Start it with `npm start`; it listens on `PORT` (default 3000) and keeps its data in `LEDGER_DB` (default `ledger.db`, or `:memory:`).
Upload a bank statement CSV (columns `Date,Description,Amount`) at `/import`; the home page lists the months you have imported.
Run the tests with `npm test`.
`node scripts/make-statement.js` prints a small example statement.
It needs Node 22.13 or later and has no other dependencies.
