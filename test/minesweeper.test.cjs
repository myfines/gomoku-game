const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, reveal, toggleFlag } = require('../minesweeper.js');

test('first reveal is safe and places the configured number of mines', () => {
  const game = createGame(5, 5, 4, () => 0);
  reveal(game, 2, 2);
  assert.equal(game.cells[2][2].mine, false);
  assert.equal(game.cells.flat().filter(cell => cell.mine).length, 4);
});

test('zero cells reveal their connected safe area without revealing mines', () => {
  const game = createGame(4, 4, 1, () => 0);
  reveal(game, 3, 3);
  assert.equal(game.cells[3][3].revealed, true);
  assert.equal(game.status, 'playing');
  assert.equal(game.cells.flat().filter(cell => cell.mine && cell.revealed).length, 0);
  assert.ok(game.cells.flat().filter(cell => cell.revealed).length > 1);
});

test('flags toggle on hidden cells and do not reveal them', () => {
  const game = createGame(3, 3, 1, () => 0);
  assert.equal(toggleFlag(game, 1, 1), true);
  assert.equal(game.cells[1][1].flagged, true);
  assert.equal(game.cells[1][1].revealed, false);
  assert.equal(toggleFlag(game, 1, 1), true);
  assert.equal(game.cells[1][1].flagged, false);
});

test('revealing a mine ends the game and exposes all mines', () => {
  const game = createGame(3, 3, 1, () => 0);
  reveal(game, 2, 2);
  const mineIndex = game.cells.flat().findIndex(cell => cell.mine);
  const x = mineIndex % game.cols;
  const y = Math.floor(mineIndex / game.cols);
  assert.ok(reveal(game, x, y));
  assert.equal(game.status, 'lost');
  assert.equal(game.cells[y][x].revealed, true);
});

test('revealing every safe cell wins and later actions are ignored', () => {
  const game = createGame(3, 3, 1, () => 0);
  reveal(game, 2, 2);
  for (let y = 0; y < game.rows; y++) for (let x = 0; x < game.cols; x++) {
    if (!game.cells[y][x].mine) reveal(game, x, y);
  }
  assert.equal(game.status, 'won');
  const before = game.cells.flat().filter(cell => cell.revealed).length;
  assert.equal(toggleFlag(game, 2, 0), false);
  assert.equal(game.cells.flat().filter(cell => cell.revealed).length, before);
});
