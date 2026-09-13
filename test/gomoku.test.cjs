const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, playMove, chooseAiMove, hasFive, undoTurn } = require('../gomoku.js');

test('后手模式由电脑在中心执黑开局，玩家以白棋应对', () => {
  const game = createGame(2);
  assert.deepEqual(game.history, [[7, 7, 1]]);
  assert.equal(game.toMove, 2);
  assert.equal(game.userColor, 2);
});

test('落子拒绝棋盘四边之外和非整数坐标，棋局状态保持不变', () => {
  const game = createGame(1);
  for (const [x, y] of [[-1, 0], [15, 0], [0, -1], [0, 15], [1.5, 3], [NaN, 0]]) {
    assert.equal(playMove(game, x, y), false);
  }
  assert.equal(game.history.length, 0);
  assert.equal(game.toMove, 1);
});

test('五连在四条轴向上贴着棋盘边缘也能判胜', () => {
  for (const [x, y, dx, dy] of [[0,0,1,0], [14,10,0,1], [0,0,1,1], [14,0,-1,1]]) {
    const game = createGame(1);
    for (let i = 0; i < 4; i++) game.grid[y + dy * i][x + dx * i] = 1;
    assert.equal(playMove(game, x + dx * 4, y + dy * 4), true);
    assert.equal(game.winner, 1);
    assert.equal(game.over, true);
  }
});

test('四子不误判获胜，电脑会挡住玩家在边缘的一步成五', () => {
  const game = createGame(1);
  game.grid[0][9] = 2; game.grid[0][10] = 1; game.grid[0][11] = 1; game.grid[0][12] = 1; game.grid[0][13] = 1;
  game.history.push([9, 0, 2], [10, 0, 1], [11, 0, 1], [12, 0, 1], [13, 0, 1]);
  game.toMove = 2;
  assert.equal(hasFive(game, 13, 0, 1), false);
  assert.deepEqual(chooseAiMove(game), [14, 0]);
});

test('AI 开局模式悔棋撤销完整回合，但保留电脑的先手棋', () => {
  const game = createGame(2);
  playMove(game, 7, 8);
  playMove(game, 8, 8);
  assert.equal(undoTurn(game), true);
  assert.deepEqual(game.history, [[7, 7, 1]]);
  assert.equal(game.toMove, 2);
  assert.equal(undoTurn(game), false);
});

test('填满最后一格且无人获胜时判和棋', () => {
  const game = createGame(1);
  let color = 1;
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
    if (x === 14 && y === 14) continue;
    game.grid[y][x] = 1 + ((Math.floor(x / 2) + Math.floor(y / 4)) % 2);
    color = 3 - color;
  }
  game.toMove = color;
  assert.equal(playMove(game, 14, 14), true);
  assert.equal(game.draw, true);
  assert.equal(game.over, true);
});





