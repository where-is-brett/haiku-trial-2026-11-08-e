// tests/smoke.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount } from '../src/lib/money.js';
import { parseDate, monthOf } from '../src/lib/dates.js';

test('a plain amount is read as cents', () => {
  assert.equal(parseAmount('12.50'), 1250);
});

test('an amount in brackets is money coming back', () => {
  assert.equal(parseAmount('(40.00)'), -4000);
});

test('an amount with a minus sign is money coming back', () => {
  assert.equal(parseAmount('-2112.90'), -211290);
});

test('an amount with thousands separators is read as cents', () => {
  assert.equal(parseAmount('1,234.50'), 123450);
});

test('a date is read as day, month, year', () => {
  assert.equal(parseDate('05/09/2026'), '2026-09-05');
  assert.equal(monthOf('05/09/2026'), '2026-09');
});
