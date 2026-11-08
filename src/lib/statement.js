// src/lib/statement.js
import { parseDate } from './dates.js';
import { parseAmount } from './money.js';

export const NOT_A_STATEMENT =
  'This is not a bank statement. Expected a CSV with the columns Date, Description, Amount.';

export class NotAStatementError extends Error {
  constructor() {
    super(NOT_A_STATEMENT);
    this.name = 'NotAStatementError';
  }
}

const HEADER = 'Date,Description,Amount';
const AMOUNT_PATTERN = /^\(?-?\d[\d,]*(\.\d+)?\)?$/;

// Splits one CSV line into fields, keeping commas inside double quotes.
function splitCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

// Accepts 'DD/MM/YYYY' with a real month and day.
function isDate(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// Reads a bank statement CSV into rows. Throws NotAStatementError on any bad line.
export function readStatement(text) {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  if (lines.length === 0) throw new NotAStatementError();
  if (splitCsvLine(lines[0]).map((f) => f.trim()).join(',') !== HEADER) {
    throw new NotAStatementError();
  }
  return lines.slice(1).map((line) => {
    const fields = splitCsvLine(line);
    if (fields.length !== 3) throw new NotAStatementError();
    const [date, description, amount] = fields.map((f) => f.trim());
    if (!isDate(date) || !AMOUNT_PATTERN.test(amount)) throw new NotAStatementError();
    return { date: parseDate(date), description, cents: parseAmount(amount) };
  });
}
