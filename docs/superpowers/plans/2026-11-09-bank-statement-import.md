# Bank statement import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/import` page that loads a bank statement CSV, skips duplicate rows and reports the counts, and a home page that lists the months with transactions, newest first.

**Architecture:** Plain Node `http` server, no new dependencies. A pure CSV reader validates the whole file before anything is written; an import function stores the rows in one SQLite transaction. The app is built by `createApp(db)` so tests can run it on an in-memory database; `src/server.js` only reads the environment and listens.

**Tech Stack:** Node 22.13+ (`node:http`, `node:sqlite`, `node:test`, built-in `Request`/`formData()` for the multipart upload).

**Spec:** `.wheelhouse/feature/approved.md` (in the worktree, not committed)

## Global Constraints

- Node 22.13 or later; no new npm dependencies (README: "has no other dependencies").
- Upload field name is `statement`; columns are exactly `Date,Description,Amount`; dates are `DD/MM/YYYY`.
- Amounts in brackets or with a minus sign are money coming back (negative cents). Read amounts with `parseAmount` (`src/lib/money.js`) and dates with `parseDate` (`src/lib/dates.js`).
- A duplicate has the same date, description and amount as a stored row; it is skipped.
- Success text is exactly `Added <n>, skipped <n>`. Non-statement error text is exactly `This is not a bank statement. Expected a CSV with the columns Date, Description, Amount.`
- `PORT` (default `3000`) and `LEDGER_DB` (default `ledger.db`, `:memory:` allowed) are read from the environment.
- Links to months use `/month?m=YYYY-MM`.

## Review Focus

1. CRLF line endings, a leading byte-order mark and trailing blank lines (`scripts/make-statement.js` writes CRLF) → Task 2 tests.
2. A description containing a comma inside quotes (`"Pasta, Pizza & Co REF 3946"`) → Task 2 test.
3. Bracketed amounts `(40.00)` and `-2112.90` read as money back → Task 1 and Task 2 tests.
4. The same file uploaded twice, and an identical line twice in one file → Task 3 tests.
5. Non-statement uploads (wrong header, `31-08-2026` date, `32/13/2026`, bad amount, empty file, no file chosen) → Task 2 and Task 4 tests.

---

### Task 1: Read bracketed amounts as money back

**Files:**
- Modify: `src/lib/money.js` (`parseAmount`)
- Test: `tests/smoke.test.js`

**Interfaces:**
- Produces: `parseAmount(text: string) -> number` (whole cents). `'(40.00)'` gives `-4000`; `'-2112.90'` gives `-211290`; `'1,234.50'` gives `123450`.

- [ ] **Step 1: Write the failing tests** — add to `tests/smoke.test.js`: `assert.equal(parseAmount('(40.00)'), -4000)`, `assert.equal(parseAmount('-2112.90'), -211290)`, `assert.equal(parseAmount('1,234.50'), 123450)`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL on `(40.00)` (currently reads `4000`).
- [ ] **Step 3: Implement** — treat a value wrapped in parentheses as negative, alongside a leading `-`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `fix: read bracketed amounts as money back`.

---

### Task 2: Read a statement CSV

**Files:**
- Create: `src/lib/statement.js`
- Test: `tests/statement.test.js`

**Interfaces:**
- Consumes: `parseDate` (`src/lib/dates.js`), `parseAmount` (`src/lib/money.js`).
- Produces: `readStatement(text: string) -> { date: string, description: string, cents: number }[]`, with `date` as `YYYY-MM-DD`. Throws `NotAStatementError` (exported class extending `Error`) with the exact non-statement message from Global Constraints. A header-only file returns `[]`.

- [ ] **Step 1: Write the failing tests**
  - The sample `data/sample-statement.csv` reads to one entry per data line (128), and the first entry is `{ date: '2026-08-02', description: 'Skyline Broadband REF 0617', cents: 858 }`.
  - `"Pasta, Pizza & Co REF 3946"` keeps its comma and reads `cents: 10229`; `15/09/2026,Marlowe Homewares REFUND,(40.00)` reads `cents: -4000`.
  - CRLF text, a leading `﻿`, and trailing blank lines read the same as LF text.
  - Each of these throws `NotAStatementError`: wrong header (`Date,Payee,Amount`); row `31-08-2026,x,1.00`; date `32/13/2026`; amount `abc`; a row with two fields; empty text; `hello world`.
- [ ] **Step 2: Run** `node --test tests/statement.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** — a small CSV line splitter that honours double quotes; strip a leading BOM; skip blank lines; check the header is exactly `Date,Description,Amount` (trimmed); check each date with `/^\d{1,2}\/\d{1,2}\/\d{4}$/` plus month 1–12 and day 1–31; check each amount with `/^\(?-?\d[\d,]*(\.\d+)?\)?$/`; then map with `parseDate` and `parseAmount`. Trim descriptions.
- [ ] **Step 4: Run** the file's tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: read statement CSV rows`.

---

### Task 3: Import without duplicates

**Files:**
- Create: `src/lib/ledger.js`, `src/lib/import.js`
- Test: `tests/import.test.js`

**Interfaces:**
- Produces: `openLedger(path: string) -> DatabaseSync` (opens the database and creates the `transactions` table if missing; the schema is unchanged from `src/server.js`).
- Consumes: `readStatement`, `NotAStatementError` (Task 2).
- Produces: `importStatement(db: DatabaseSync, text: string) -> { added: number, skipped: number }`. It calls `readStatement` first, so a bad file throws before any write. Rows are checked and inserted in one transaction, and each row is compared against rows already stored, including rows inserted earlier in the same upload. Descriptions are compared exactly.

- [ ] **Step 1: Write the failing tests** (on `openLedger(':memory:')`)
  - Importing the sample gives `{ added: 128, skipped: 0 }`; importing it again gives `{ added: 0, skipped: 128 }`.
  - A file with the same data line twice gives `{ added: 1, skipped: 1 }`.
  - A file whose first row is valid and whose second row has date `31-08-2026` throws `NotAStatementError`, and the `transactions` table still has 0 rows.
- [ ] **Step 2: Run** `node --test tests/import.test.js`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** `openLedger` and `importStatement`. Use `BEGIN` / `COMMIT`, with `ROLLBACK` if an insert throws.
- [ ] **Step 4: Run** the file's tests, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: import statement rows, skipping duplicates`.

---

### Task 4: The /import page

**Files:**
- Create: `src/app.js`
- Modify: `src/server.js` (reads `PORT` and `LEDGER_DB`, calls `openLedger` and `createApp`, then listens and logs `listening on <port>` as now)
- Test: `tests/import-page.test.js`

**Interfaces:**
- Consumes: `openLedger`, `importStatement`, `NotAStatementError`.
- Produces: `createApp(db: DatabaseSync) -> http.Server`. It keeps the existing `page()` wrapper and the `/` route, and adds the routes below.

Routes:
- `GET /import` returns 200 with a form: `method="post"`, `enctype="multipart/form-data"`, `action="/import"`, and `<input type="file" name="statement">`.
- `POST /import` reads the body with `await new Request(url, { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: Readable.toWeb(req), duplex: 'half' }).formData()` and takes `get('statement')`. A missing file, or a value that is a string, counts as not a statement. Success returns 200 with `<p>Added <n>, skipped <n></p>`. A `NotAStatementError` returns 400 with `<p>` and the exact error message.

- [ ] **Step 1: Write the failing tests**. Start `createApp(openLedger(':memory:'))` on port 0. Use the global `FormData` and `Blob` with `fetch`.
  - GET `/import` contains `name="statement"`.
  - POST the sample: 200 and the body contains `Added 128, skipped 0`. POST it again: contains `Added 0, skipped 128`.
  - POST `hello world` as `statement`: 400, contains the exact error text, and the table still has the 128 rows from the earlier upload (use a fresh app and DB for this case so the count is 0).
  - POST with no `statement` field: 400 with the same text.
- [ ] **Step 2: Run** `node --test tests/import-page.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `createApp` and the routes; move the existing `/` and `page()` code into `src/app.js`; update `src/server.js` to use it.
- [ ] **Step 4: Run** the file's tests, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add /import page`.

---

### Task 5: Months on the home page

**Files:**
- Modify: `src/app.js` (the `/` route)
- Test: `tests/home.test.js`

**Interfaces:**
- Consumes: `createApp`, `importStatement`.
- Produces: the `/` page keeps the existing `N transactions imported` line (or `Nothing imported yet`). When there are transactions, it adds a `<ul>` with one `<li><a href="/month?m=YYYY-MM">YYYY-MM</a></li>` per month, from `SELECT DISTINCT substr(date, 1, 7) AS month FROM transactions ORDER BY month DESC`.

- [ ] **Step 1: Write the failing tests**
  - Empty database: body contains `Nothing imported yet` and no `/month?m=`.
  - After importing the sample: the body contains `href="/month?m=2026-10"`, `href="/month?m=2026-09"` and `href="/month?m=2026-08"`, in that order (check `indexOf`), and no `2026-07`.
- [ ] **Step 2: Run** `node --test tests/home.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the month query and list in the `/` route.
- [ ] **Step 4: Run** the file's tests, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: list months on the home page`.

---

### Task 6: Environment settings and README

**Files:**
- Test: `tests/env.test.js`
- Modify: `README.md` (one line on `/import`)

**Interfaces:**
- Consumes: `src/server.js` as built by Task 4.

- [ ] **Step 1: Write the failing tests**. Spawn `node src/server.js` with `PORT=0` and `LEDGER_DB=:memory:`. Read the first stdout line, `listening on <n>`, then GET `/` and expect 200. Spawn again with `LEDGER_DB` set to a file in a `mkdtemp` directory, and expect that file to exist after startup. Kill each child in `finally`.
- [ ] **Step 2: Run** `node --test tests/env.test.js`. Expected: PASS if Task 4 kept the env reads; if FAIL, fix `src/server.js` until it passes.
- [ ] **Step 3: Update** `README.md` with one line saying statements are imported at `/import`.
- [ ] **Step 4: Run** `npm test`. Expected: all tests PASS.
- [ ] **Step 5: Commit** `test: check PORT and LEDGER_DB; document /import`.

---

## Self-Review

- **Spec coverage:** `/import` accepts the CSV and reports counts (Task 4); re-import skips all (Task 3, Task 4); non-statement gets a plain error and stores nothing (Task 2, Task 3, Task 4); home lists months newest first with links (Task 5); PORT and LEDGER_DB from env (Task 6). Bracketed amounts (Task 1).
- **Type consistency:** `readStatement` → `{date, description, cents}` used by `importStatement`; `importStatement` → `{added, skipped}` used by the page; `openLedger` and `createApp` take a `DatabaseSync`. `NotAStatementError` is used by Tasks 2–4.
- **Proportion:** signatures and test assertions only; no implementation bodies.
