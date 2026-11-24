import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, DISHES, demand, helpTable, openShift, readSave, seatGuest, stopArrivals,
  buyStock, STOCK_COST, STOCK_PACK, tick
} from '../quan/game.js';

const advance = (game, count) => {
  for (let i = 0; i < count; i += 1) tick(game);
};
function until(game, condition) {
  for (let i = 0; i < 1800 && !condition(); i += 1) tick(game);
  assert.ok(condition(), 'The simulated shift did not reach the expected state');
}

test('one guest goes through the entire shift workflow and pays exactly once', () => {
  const game = createGame(713);
  openShift(game);
  game.queue.splice(1);
  game.nextArrival = 1000;
  const dish = DISHES[game.queue[0].dish];
  const stages = new Set();
  assert.equal(seatGuest(game, 1), true);
  game.queue.length = 0;

  until(game, () => {
    const { stage } = game.tables[0];
    stages.add(stage);
    if (stage !== 'dirty' && stage !== 'free') assert.equal(game.stats.sales, 0);
    return stage === 'free';
  });
  assert.deepEqual([...stages], ['choosing', 'order', 'queued', 'cooking', 'ready', 'eating', 'check', 'dirty', 'free']);
  assert.equal(game.stock, 23 - dish.stock);
  assert.equal(game.cash, 180 + dish.price);
  assert.equal(game.stats.served, 1);
  advance(game, 30);
  assert.equal(game.stats.sales, dish.price);
  assert.equal(game.totalServed, 1);
});

test('the dashboard distinguishes stock, kitchen and service bottlenecks', () => {
  const game = createGame(366);
  openShift(game);
  assert.equal(demand(game).door, 2);
  assert.equal(seatGuest(game, 1), true);
  game.stock = 0;
  until(game, () => demand(game).shortStock);
  assert.equal(demand(game).kitchen, 1);
  assert.equal(game.stock, 0);
  assert.equal(game.workers.cook.job, null);
  assert.equal(game.stats.sales, 0);
  assert.equal(buyStock(game), true);
  assert.equal(game.cash, 180 - STOCK_COST);
  assert.equal(game.stock, STOCK_PACK);
  game.workers.waiter.auto = false;
  until(game, () => demand(game).ready === 1);
  assert.equal(demand(game).kitchen, 0);
  assert.match(helpTable(game, 1), /giao việc/);
  until(game, () => game.tables[0].stage === 'dirty');
  assert.equal(demand(game).dirty, 1);
  assert.match(helpTable(game, 1), /giao việc/);
  until(game, () => game.tables[0].stage === 'free');
});

test('a saved shift with a job in progress reproduces the same seeded outcome', () => {
  const game = createGame(2026);
  openShift(game);
  game.autoSeat = true;
  until(game, () => Boolean(game.workers.cook.job));
  const serialized = JSON.stringify(game);
  const loaded = readSave(serialized);
  assert.ok(loaded);
  assert.equal(readSave(serialized.replace('"cash":180', '"cash":-1')), null);
  assert.equal(readSave(serialized.replace('"tableId":1', '"tableId":8')), null);

  for (const playing of [game, loaded]) {
    const refill = () => {
      if (playing.stock < 6) buyStock(playing);
    };
    for (let i = 0; i < 920; i += 1) {
      refill();
      tick(playing);
    }
    if (playing.mode === 'running') stopArrivals(playing);
    until(playing, () => {
      refill();
      return playing.mode === 'complete';
    });
    assert.ok(playing.stats.served > 3);
    assert.ok(playing.tables.every(table => table.stage === 'free'));
  }
  assert.deepEqual(loaded, game);
  assert.equal(openShift(loaded), true);
  assert.equal(loaded.shift, 2);
  assert.equal(loaded.cash, game.cash);
  assert.equal(loaded.stats.served, 0);
});
