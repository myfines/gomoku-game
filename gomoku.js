(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Gomoku = api;
  if (typeof document !== 'undefined') api.mount(document);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SIZE = 15;
  const AXES = [[1,0],[0,1],[1,1],[1,-1]];
  const EMPTY = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

  function createGame(userColor = 1) {
    if (userColor !== 1 && userColor !== 2) throw new RangeError('userColor must be black (1) or white (2)');
    const game = { size: SIZE, grid: EMPTY(), history: [], userColor, toMove: 1, over: false, draw: false, winner: 0, lastMove: null };
    if (userColor === 2) {
      game.grid[7][7] = 1;
      game.history.push([7, 7, 1]);
      game.lastMove = [7, 7];
      game.toMove = 2;
    }
    return game;
  }

  function inBounds(game, x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < game.size && y >= 0 && y < game.size;
  }

  function playMove(game, x, y) {
    if (game.over || !inBounds(game, x, y) || game.grid[y][x] !== 0) return false;
    const color = game.toMove;
    game.grid[y][x] = color;
    game.history.push([x, y, color]);
    game.lastMove = [x, y];
    if (hasFive(game, x, y, color)) {
      game.over = true;
      game.winner = color;
      return true;
    }
    if (game.grid.every(row => row.every(cell => cell !== 0))) {
      game.over = true;
      game.draw = true;
      return true;
    }
    game.toMove = 3 - color;
    return true;
  }

  const WIN_SCORE = 1_000_000_000;
  const WINDOW_SCORE = [0, 2, 14, 180, 22_000, 0];

  function hasFiveGrid(grid, x, y, color) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= SIZE || y < 0 || y >= SIZE || grid[y][x] !== color) return false;
    for (const [dx, dy] of AXES) {
      let count = 1;
      for (const direction of [-1, 1]) {
        let cx = x + dx * direction, cy = y + dy * direction;
        while (cx >= 0 && cx < SIZE && cy >= 0 && cy < SIZE && grid[cy][cx] === color) {
          count++; cx += dx * direction; cy += dy * direction;
        }
      }
      if (count >= 5) return true;
    }
    return false;
  }

  function hasFive(game, x, y, color) {
    return inBounds(game, x, y) && hasFiveGrid(game.grid, x, y, color);
  }

  function scoreWindow(grid, startX, startY, dx, dy, color) {
    let own = 0, blocked = false;
    for (let i = 0; i < 5; i++) {
      const cell = grid[startY + dy * i][startX + dx * i];
      if (cell === 3 - color) { blocked = true; break; }
      if (cell === color) own++;
    }
    return blocked || own === 0 ? 0 : own === 5 ? WIN_SCORE : WINDOW_SCORE[own];
  }

  function evaluateBoard(grid, color) {
    let score = 0;
    for (const [dx, dy] of AXES) {
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const endX = x + dx * 4, endY = y + dy * 4;
        if (endX < 0 || endX >= SIZE || endY < 0 || endY >= SIZE) continue;
        score += scoreWindow(grid, x, y, dx, dy, color);
        score -= scoreWindow(grid, x, y, dx, dy, 3 - color);
      }
    }
    return score;
  }

  function scoreMove(grid, x, y, color) {
    grid[y][x] = color;
    if (hasFiveGrid(grid, x, y, color)) { grid[y][x] = 0; return WIN_SCORE; }
    let score = 0;
    for (const [dx, dy] of AXES) for (let offset = -4; offset <= 0; offset++) {
      const sx = x + dx * offset, sy = y + dy * offset;
      const endX = sx + dx * 4, endY = sy + dy * 4;
      if (sx < 0 || sx >= SIZE || sy < 0 || sy >= SIZE || endX < 0 || endX >= SIZE || endY < 0 || endY >= SIZE) continue;
      score += scoreWindow(grid, sx, sy, dx, dy, color);
    }
    grid[y][x] = 0;
    return score;
  }

  function generateCandidates(grid, color, limit) {
    const occupied = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (grid[y][x] !== 0) occupied.push([x, y]);
    if (!occupied.length) return [[7, 7]];
    const candidates = new Set();
    for (const [x, y] of occupied) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const cx = x + dx, cy = y + dy;
      if (cx >= 0 && cx < SIZE && cy >= 0 && cy < SIZE && grid[cy][cx] === 0) candidates.add(`${cx},${cy}`);
    }
    const ranked = [...candidates].map(key => {
      const [x, y] = key.split(',').map(Number);
      const attack = scoreMove(grid, x, y, color);
      const defense = scoreMove(grid, x, y, 3 - color);
      const centerBias = (SIZE - Math.abs(7 - x) - Math.abs(7 - y)) * 0.01;
      return { move: [x, y], score: attack + defense * 0.96 + centerBias };
    });
    ranked.sort((a, b) => b.score - a.score || a.move[1] - b.move[1] || a.move[0] - b.move[0]);
    if (ranked.length) return ranked.slice(0, limit).map(item => item.move);
    let nearest = null, distance = Infinity;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (grid[y][x] === 0) {
      const d = Math.abs(7 - x) + Math.abs(7 - y);
      if (d < distance) { nearest = [x, y]; distance = d; }
    }
    return nearest ? [nearest] : [];
  }

  function positionKey(grid, color) {
    return `${color}:${grid.map(row => row.join('')).join('')}`;
  }

  function normalizeMateScore(score, ply, toTable) {
    if (score > WIN_SCORE - 100_000) return toTable ? score + ply : score - ply;
    if (score < -WIN_SCORE + 100_000) return toTable ? score - ply : score + ply;
    return score;
  }

  function winningMoves(grid, color) {
    return generateCandidates(grid, color, 12).filter(([x, y]) => scoreMove(grid, x, y, color) === WIN_SCORE);
  }

  function quiescence(grid, color, alpha, beta, lastMove, ply, qDepth) {
    if (lastMove && hasFiveGrid(grid, lastMove[0], lastMove[1], 3 - color)) return -WIN_SCORE + ply;
    const wins = winningMoves(grid, color);
    if (wins.length) return WIN_SCORE - ply - 1;
    const threats = winningMoves(grid, 3 - color);
    if (!threats.length) return evaluateBoard(grid, color);
    if (qDepth <= 0 || threats.length !== 1) return -WIN_SCORE + ply + 1;
    const [x, y] = threats[0];
    grid[y][x] = color;
    const score = hasFiveGrid(grid, x, y, color)
      ? WIN_SCORE - ply - 1
      : -quiescence(grid, 3 - color, -beta, -alpha, [x, y], ply + 1, qDepth - 1);
    grid[y][x] = 0;
    return score;
  }

  function search(grid, color, depth, alpha, beta, lastMove, ply, context) {
    context.nodes++;
    if (context.nodes >= context.nodeLimit || (context.nodes % 64 === 0 && Date.now() >= context.deadline)) {
      context.aborted = true;
      return evaluateBoard(grid, color);
    }
    if (lastMove && hasFiveGrid(grid, lastMove[0], lastMove[1], 3 - color)) return -WIN_SCORE + ply;
    if (depth === 0) return quiescence(grid, color, alpha, beta, lastMove, ply, 3);

    const key = positionKey(grid, color), alphaStart = alpha, betaStart = beta;
    const cached = context.table.get(key);
    if (cached && cached.depth >= depth) {
      const cachedScore = normalizeMateScore(cached.score, ply, false);
      if (cached.bound === 'exact') return cachedScore;
      if (cached.bound === 'lower') alpha = Math.max(alpha, cachedScore);
      else if (cached.bound === 'upper') beta = Math.min(beta, cachedScore);
      if (alpha >= beta) return cachedScore;
    }

    const moves = generateCandidates(grid, color, 7);
    if (!moves.length) return 0;
    const preferred = cached?.bestMove;
    if (preferred) {
      const index = moves.findIndex(([x, y]) => x === preferred[0] && y === preferred[1]);
      if (index > 0) moves.unshift(...moves.splice(index, 1));
    }
    let best = -Infinity, bestMove = null;
    for (const [x, y] of moves) {
      grid[y][x] = color;
      const score = -search(grid, 3 - color, depth - 1, -beta, -alpha, [x, y], ply + 1, context);
      grid[y][x] = 0;
      if (context.aborted) return evaluateBoard(grid, color);
      if (score > best) { best = score; bestMove = [x, y]; }
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    const bound = best <= alphaStart ? 'upper' : best >= betaStart ? 'lower' : 'exact';
    context.table.set(key, { depth, score: normalizeMateScore(best, ply, true), bound, bestMove });
    return best;
  }

  function chooseAiMove(game, options = {}) {
    if (game.over) return null;
    const aiColor = 3 - game.userColor;
    const grid = game.grid.map(row => row.slice());
    if (!grid.some(row => row.some(cell => cell !== 0))) return [7, 7];
    const candidates = generateCandidates(grid, aiColor, 12);
    if (!candidates.length) return null;
    for (const [x, y] of candidates) {
      grid[y][x] = aiColor;
      const wins = hasFiveGrid(grid, x, y, aiColor);
      grid[y][x] = 0;
      if (wins) return [x, y];
    }
    const opponentWins = candidates.filter(([x, y]) => scoreMove(grid, x, y, game.userColor) === WIN_SCORE);
    if (opponentWins.length === 1) return opponentWins[0];

    const context = {
      nodes: 0,
      nodeLimit: Math.max(500, Math.min(options.nodeLimit || 14_000, 60_000)),
      deadline: Date.now() + Math.max(10, Math.min(options.timeBudgetMs || 90, 1_000)),
      aborted: false,
      table: new Map()
    };
    const maxDepth = Math.max(1, Math.min(options.maxDepth || 6, 8));
    let best = candidates[0];
    for (let depth = 1; depth <= maxDepth; depth++) {
      let iterationBest = null, iterationScore = -Infinity, alpha = -Infinity;
      const ordered = candidates.slice();
      const preferredIndex = ordered.findIndex(([x, y]) => x === best[0] && y === best[1]);
      if (preferredIndex > 0) ordered.unshift(...ordered.splice(preferredIndex, 1));
      for (const [x, y] of ordered) {
        if (context.nodes >= context.nodeLimit || Date.now() >= context.deadline) { context.aborted = true; break; }
        grid[y][x] = aiColor;
        const score = -search(grid, game.userColor, depth - 1, -Infinity, -alpha, [x, y], 1, context);
        grid[y][x] = 0;
        if (context.aborted) break;
        if (score > iterationScore) { iterationScore = score; iterationBest = [x, y]; }
        if (score > alpha) alpha = score;
      }
      if (context.aborted || !iterationBest) break;
      best = iterationBest;
      if (iterationScore >= WIN_SCORE - 10) break;
    }
    return best;
  }
  function undoTurn(game) {
    const openingLength = game.userColor === 2 ? 1 : 0;
    if (game.history.length <= openingLength) return false;
    let removed = 0;
    while (removed < 2 && game.history.length > openingLength) {
      const [x, y] = game.history.pop();
      game.grid[y][x] = 0;
      removed++;
    }
    game.over = false; game.draw = false; game.winner = 0;
    const previous = game.history[game.history.length - 1];
    game.toMove = previous ? 3 - previous[2] : 1;
    game.lastMove = previous ? [previous[0], previous[1]] : null;
    return true;
  }

  function mount(doc) {
    const canvas = doc.getElementById('board');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let game, busy = false, aiTimer = null;
    const status = doc.getElementById('status'), caption = doc.getElementById('caption');
    const turnStone = doc.getElementById('turnStone'), count = doc.getElementById('count');
    const modeButton = doc.getElementById('mode-toggle');

    function describeTurn() {
      if (game.over) {
        status.textContent = game.draw ? '平局！棋盘已满' : game.winner === game.userColor ? '你赢了！' : '这局我赢啦';
        caption.textContent = '好棋。重新开局，再来一盘？';
        status.classList.add('result');
        turnStone.className = `stone ${game.winner === 2 ? 'white' : ''}`;
      } else if (busy) {
        status.textContent = '我在想…';
        caption.textContent = `我执${game.userColor === 1 ? '白' : '黑'}棋思考中。`;
        turnStone.className = `stone ${game.userColor === 1 ? 'white' : ''}`;
      } else {
        status.textContent = '轮到你了';
        caption.textContent = game.userColor === 1 ? '你执黑先行。点击棋盘交叉点落子。' : '你执白棋，电脑先行。点击交叉点落子。';
        turnStone.className = `stone ${game.userColor === 2 ? 'white' : ''}`;
        status.classList.remove('result');
      }
    }

    function render() {
      const dpr = window.devicePixelRatio || 1, size = canvas.clientWidth;
      canvas.width = size * dpr; canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
      const pad = size * 0.065, step = (size - pad * 2) / (SIZE - 1);
      ctx.strokeStyle = '#70491f'; ctx.lineWidth = Math.max(1, size / 570);
      for (let i = 0; i < SIZE; i++) {
        const p = pad + i * step;
        ctx.beginPath(); ctx.moveTo(pad, p); ctx.lineTo(size - pad, p); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p, pad); ctx.lineTo(p, size - pad); ctx.stroke();
      }
      for (const [x, y] of [[3,3],[7,3],[11,3],[3,7],[7,7],[11,7],[3,11],[7,11],[11,11]]) {
        ctx.beginPath(); ctx.arc(pad + x * step, pad + y * step, size * 0.006, 0, Math.PI * 2); ctx.fillStyle = '#70491f'; ctx.fill();
      }
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (game.grid[y][x]) {
        const px = pad + x * step, py = pad + y * step, r = step * 0.43;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = game.grid[y][x] === 1 ? '#171615' : '#fffdf6';
        ctx.shadowColor = '#0004'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2; ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        if (game.grid[y][x] === 2) { ctx.strokeStyle = '#c8c1b5'; ctx.lineWidth = 1; ctx.stroke(); }
        if (game.lastMove && game.lastMove[0] === x && game.lastMove[1] === y) {
          ctx.fillStyle = game.grid[y][x] === 1 ? '#f2eee5' : '#6a6258'; ctx.fillRect(px - 2, py - 2, 4, 4);
        }
      }
      count.textContent = game.history.length;
      modeButton.textContent = `切换为${game.userColor === 1 ? '后手' : '先手'}模式`;
      modeButton.setAttribute('aria-pressed', String(game.userColor === 2));
      doc.getElementById('role-label').textContent = `你执${game.userColor === 1 ? '黑' : '白'} · ${game.userColor === 1 ? '先手' : '后手'}`;
      describeTurn();
    }

    function computerTurn() {
      if (game.over) { busy = false; render(); return; }
      busy = true; render();
      aiTimer = window.setTimeout(() => {
        aiTimer = null;
        if (game.over) { busy = false; render(); return; }
        const move = chooseAiMove(game);
        if (move) playMove(game, move[0], move[1]);
        busy = false; render();
      }, 380);
    }

    function reset(userColor = game ? game.userColor : 1) {
      if (aiTimer !== null) window.clearTimeout(aiTimer);
      aiTimer = null; busy = false; game = createGame(userColor); render();
      if (game.toMove !== game.userColor) computerTurn();
    }

    canvas.addEventListener('click', event => {
      if (game.over || busy) return;
      const rect = canvas.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height), pad = size * 0.065, step = (size - pad * 2) / (SIZE - 1);
      const x = Math.round((event.clientX - rect.left - pad) / step);
      const y = Math.round((event.clientY - rect.top - pad) / step);
      if (!inBounds(game, x, y)) return;
      const px = pad + x * step, py = pad + y * step;
      if (Math.hypot(event.clientX - rect.left - px, event.clientY - rect.top - py) > step * 0.48) return;
      if (!playMove(game, x, y)) return;
      render();
      if (!game.over) computerTurn();
    });

    doc.getElementById('restart').addEventListener('click', () => reset());
    doc.getElementById('undo').addEventListener('click', () => {
      if (busy || !undoTurn(game)) return;
      render();
    });
    modeButton.addEventListener('click', () => reset(game.userColor === 1 ? 2 : 1));
    window.addEventListener('resize', render);
    reset(1);
  }

  return { SIZE, createGame, hasFive, playMove, chooseAiMove, undoTurn, mount };
});
