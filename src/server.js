// src/server.js
import { createApp } from './app.js';
import { openLedger } from './lib/ledger.js';

const port = Number(process.env.PORT ?? 3000);
const db = openLedger(process.env.LEDGER_DB ?? 'ledger.db');
const server = createApp(db);

server.listen(port, () => {
  console.log(`listening on ${server.address().port}`);
});
