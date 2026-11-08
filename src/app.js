// src/app.js
import http from 'node:http';
import { Readable } from 'node:stream';
import { importStatement } from './lib/import.js';
import { NotAStatementError, NOT_A_STATEMENT } from './lib/statement.js';

function page(body) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Spending tracker</title></head>
<body>
<main>
<h1>Spending tracker</h1>
${body}
</main>
</body>
</html>
`;
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page(body));
}

const importForm = `<form method="post" action="/import" enctype="multipart/form-data">
<label>Bank statement CSV <input type="file" name="statement" accept=".csv"></label>
<button type="submit">Import</button>
</form>`;

// Reads the uploaded file from a multipart body. Anything else is not a statement.
async function readUpload(req) {
  let form;
  try {
    const request = new Request('http://localhost/import', {
      method: 'POST',
      headers: { 'content-type': req.headers['content-type'] ?? '' },
      body: Readable.toWeb(req),
      duplex: 'half',
    });
    form = await request.formData();
  } catch {
    throw new NotAStatementError();
  }
  const file = form.get('statement');
  if (!file || typeof file === 'string') throw new NotAStatementError();
  return file.text();
}

export function createApp(db) {
  return http.createServer(createHandler(db));
}

export function createHandler(db) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/') {
        const { n } = db.prepare('SELECT COUNT(*) AS n FROM transactions').get();
        if (n === 0) {
          send(res, 200, '<p>Nothing imported yet</p>');
          return;
        }
        const months = db
          .prepare('SELECT DISTINCT substr(date, 1, 7) AS month FROM transactions ORDER BY month DESC')
          .all();
        const links = months
          .map(({ month }) => `<li><a href="/month?m=${month}">${month}</a></li>`)
          .join('\n');
        send(res, 200, `<p>${n} transactions imported</p>\n<ul>\n${links}\n</ul>`);
        return;
      }
      if (url.pathname === '/import' && req.method === 'GET') {
        send(res, 200, importForm);
        return;
      }
      if (url.pathname === '/import' && req.method === 'POST') {
        try {
          const { added, skipped } = importStatement(db, await readUpload(req));
          send(res, 200, `<p>Added ${added}, skipped ${skipped}</p>`);
        } catch (err) {
          if (!(err instanceof NotAStatementError)) throw err;
          send(res, 400, `<p>${NOT_A_STATEMENT}</p>`);
        }
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Server error');
    }
  };
}
