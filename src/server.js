// src/server.js
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { openLedger } from './lib/ledger.js';

const { port, dbPath } = readConfig(process.env);
const server = createApp(openLedger(dbPath));

server.listen(port, () => {
  console.log(`listening on ${server.address().port}`);
});
