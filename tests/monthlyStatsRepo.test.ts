import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import {
  getFirstFlowAt,
  getMonthBalanceDeltas,
  getMonthlyFlows,
  MAX_MONTHS_PER_QUERY,
} from '../src/db/repositories/monthlyStats';
import type { StatisticsScope } from '../src/db/repositories/statistics';
import { cumulativeBalances, monthsEndingAt, summarizeMonths } from '../src/domain/monthlyStats';
import { addTx, createLedgerTables } from './ledgerFixture';
import { testDb } from './stubs/dbClient';

let savedTz: string | undefined;
before(() => {
  savedTz = process.env.TZ;
  process.env.TZ = 'Europe/Budapest';
});
after(() => {
  if (savedTz === undefined) delete process.env.TZ;
  else process.env.TZ = savedTz;
});

const ALL: StatisticsScope = { mode: 'all' };
const OUTSIDE_JAR: StatisticsScope = { mode: 'exclude_jar', jarId: 'jar' };
const WALLET: StatisticsScope = { mode: 'pocket', pocketId: 'p1' };

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('getMonthlyFlows', () => {
  beforeEach(() => {
    createLedgerTables();
    testDb.exec(`INSERT INTO categories VALUES ('food', 'Food', '#ff0000')`);
  });

  test('groups by month, kind, category and pocket, with names', async () => {
    addTx({ kind: 'expense', amount: 100, at: at(2026, 10, 3), pocket: 'p1', category: 'food' });
    addTx({ kind: 'expense', amount: 50, at: at(2026, 10, 9), pocket: 'p1', category: 'food' });
    addTx({ kind: 'expense', amount: 7, at: at(2026, 10, 9), pocket: 'p2' });
    addTx({ kind: 'income', amount: 900, at: at(2026, 9, 9), pocket: 'jar' });
    const rows = await getMonthlyFlows('HUF', ALL, monthsEndingAt('2026-10', 2));
    const sorted = [...rows].sort((a, b) => (a.month + a.pocketId).localeCompare(b.month + b.pocketId));
    assert.deepEqual(sorted, [
      { month: '2026-09', kind: 'income', categoryId: null, categoryName: null, categoryColor: null, pocketId: 'jar', pocketName: 'Jar', total: 900n },
      { month: '2026-10', kind: 'expense', categoryId: 'food', categoryName: 'Food', categoryColor: '#ff0000', pocketId: 'p1', pocketName: 'Wallet', total: 150n },
      { month: '2026-10', kind: 'expense', categoryId: null, categoryName: null, categoryColor: null, pocketId: 'p2', pocketName: 'Bank', total: 7n },
    ]);
  });

  test('splits at local midnight on the 1st', async () => {
    const midnight = new Date(2026, 10, 1).getTime();
    addTx({ kind: 'expense', amount: 1, at: midnight - 1, pocket: 'p1' });
    addTx({ kind: 'expense', amount: 10, at: midnight, pocket: 'p1' });
    const s = summarizeMonths(
      await getMonthlyFlows('HUF', ALL, monthsEndingAt('2026-11', 2)),
      ['2026-10', '2026-11']
    );
    assert.equal(s.get('2026-10')!.expense, 1n);
    assert.equal(s.get('2026-11')!.expense, 10n);
  });

  test('leaves out transfers, other currencies and pockets outside the scope', async () => {
    addTx({ kind: 'transfer', amount: 500, at: at(2026, 10, 3), from: 'p1', to: 'p2' });
    addTx({ kind: 'expense', amount: 3, at: at(2026, 10, 3), pocket: 'p1', currency: 'EUR' });
    addTx({ kind: 'expense', amount: 20, at: at(2026, 10, 3), pocket: 'jar' });
    addTx({ kind: 'expense', amount: 5, at: at(2026, 10, 3), pocket: 'p2' });
    addTx({ kind: 'income', amount: 40, at: at(2026, 10, 3), pocket: 'p1' });
    const month = monthsEndingAt('2026-10', 1);
    const sum = async (scope: StatisticsScope) =>
      summarizeMonths(await getMonthlyFlows('HUF', scope, month), ['2026-10']).get('2026-10');
    assert.deepEqual(await sum(ALL), { key: '2026-10', income: 40n, expense: 25n, net: 15n });
    assert.deepEqual(await sum(OUTSIDE_JAR), { key: '2026-10', income: 40n, expense: 5n, net: 35n });
    assert.deepEqual(await sum(WALLET), { key: '2026-10', income: 40n, expense: 0n, net: 40n });
  });

  test('sums above 2^53 stay exact', async () => {
    addTx({ kind: 'income', amount: 2 ** 53, at: at(2026, 10, 3), pocket: 'p1' });
    addTx({ kind: 'income', amount: 2 ** 53, at: at(2026, 10, 4), pocket: 'p1' });
    addTx({ kind: 'income', amount: 1, at: at(2026, 10, 5), pocket: 'p1' });
    const rows = await getMonthlyFlows('HUF', ALL, monthsEndingAt('2026-10', 1));
    assert.equal(rows[0]!.total, 2n ** 54n + 1n);
  });

  test('refuses more months than one query may carry', async () => {
    await assert.rejects(getMonthlyFlows('HUF', ALL, monthsEndingAt('2026-10', MAX_MONTHS_PER_QUERY + 1)));
    assert.deepEqual(await getMonthlyFlows('HUF', ALL, []), []);
  });
});

describe('getMonthBalanceDeltas → month-end balances', () => {
  beforeEach(createLedgerTables);

  test('the first month carries everything before it; transfers move pocket balances', async () => {
    addTx({ kind: 'income', amount: 1000, at: at(2025, 1, 5), pocket: 'p1' });
    addTx({ kind: 'transfer', amount: 300, at: at(2026, 8, 5), from: 'p1', to: 'jar' });
    addTx({ kind: 'transfer', amount: 100, at: at(2026, 9, 5), from: 'p1', to: 'p2' });
    addTx({ kind: 'expense', amount: 50, at: at(2026, 10, 5), pocket: 'p2' });
    addTx({ kind: 'income', amount: 9, at: at(2026, 11, 5), pocket: 'p2' });
    const months = monthsEndingAt('2026-10', 3);
    const balances = async (scope: StatisticsScope) =>
      [...cumulativeBalances(months, await getMonthBalanceDeltas('HUF', scope, months)).values()];
    assert.deepEqual(await balances(ALL), [1000n, 1000n, 950n]);
    assert.deepEqual(await balances(OUTSIDE_JAR), [700n, 700n, 650n]);
    assert.deepEqual(await balances(WALLET), [700n, 600n, 600n]);
    assert.deepEqual(await balances({ mode: 'pocket', pocketId: 'jar' }), [300n, 300n, 300n]);
  });
});

describe('getFirstFlowAt', () => {
  beforeEach(createLedgerTables);

  test('earliest income or expense in the scope and currency; transfers do not count', async () => {
    addTx({ kind: 'transfer', amount: 5, at: 100, from: 'p1', to: 'p2' });
    addTx({ kind: 'income', amount: 5, at: 200, pocket: 'jar' });
    addTx({ kind: 'expense', amount: 5, at: 300, pocket: 'p1' });
    addTx({ kind: 'expense', amount: 5, at: 50, pocket: 'p1', currency: 'EUR' });
    assert.equal(await getFirstFlowAt('HUF', ALL), 200);
    assert.equal(await getFirstFlowAt('HUF', OUTSIDE_JAR), 300);
    assert.equal(await getFirstFlowAt('USD', ALL), null);
  });
});
