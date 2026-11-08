// src/config.js

// Reads PORT (default 3000) and LEDGER_DB (default 'ledger.db', or ':memory:') from the environment.
export function readConfig(env) {
  return {
    port: Number(env.PORT ?? 3000),
    dbPath: env.LEDGER_DB ?? 'ledger.db',
  };
}
