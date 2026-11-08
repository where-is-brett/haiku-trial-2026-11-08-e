// tests/http-helpers.js
// Runs requests through a handler in-process, so no socket is opened.
import { Readable } from 'node:stream';

export async function request(handler, { method = 'GET', path = '/', headers = {}, body = null } = {}) {
  const req = Readable.from(body ? [body] : []);
  req.method = method;
  req.url = path;
  req.headers = headers;
  const res = {
    status: 0,
    body: '',
    writeHead(status) {
      this.status = status;
    },
    end(text = '') {
      this.body = text;
    },
  };
  await handler(req, res);
  return res;
}

export async function multipartRequest(handler, path, form) {
  const built = new Request(`http://localhost${path}`, { method: 'POST', body: form });
  return request(handler, {
    method: 'POST',
    path,
    headers: { 'content-type': built.headers.get('content-type') },
    body: Buffer.from(await built.arrayBuffer()),
  });
}

export function statementForm(text, field = 'statement') {
  const form = new FormData();
  form.append(field, new Blob([text], { type: 'text/csv' }), 'statement.csv');
  return form;
}
