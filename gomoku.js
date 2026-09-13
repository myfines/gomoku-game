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

  function hasFive(game, x, y, color) {
    if (!inBounds(game, x, y) || game.grid[y][x] !== color) return false;
    for (const [dx, dy] of AXES) {
      let count = 1;
      for (const direction of [-1, 1]) {
        let cx = x + dx * direction, cy = y + dy * direction;
        while (inBounds(game, cx, cy) && game.grid[cy][cx] === color) {
          count++; cx += dx * direction; cy += dy * direction;
        }
      }
      if (count >= 5) return true;
    }
    return false;
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

  function scoreMove(game, x, y, color) {
    let total = 0;
    for (const [dx, dy] of AXES) {
      let stones = 1, open = 0;
      for (const direction of [-1, 1]) {
        let cx = x + dx * direction, cy = y + dy * direction;
        while (inBounds(game, cx, cy) && game.grid[cy][cx] === color) {
          stones++; cx += dx * direction; cy += dy * direction;
        }
        if (inBounds(game, cx, cy) && game.grid[cy][cx] === 0) open++;
      }
      total += stones >= 5 ? 1_000_000 : stones === 4 && open === 2 ? 20_000 : stones === 4 && open === 1 ? 5_000 : stones === 3 && open === 2 ? 1_200 : stones === 3 && open === 1 ? 220 : stones === 2 && open === 2 ? 100 : stones === 2 && open === 1 ? 20 : 1;
    }
    return total;
  }

  function chooseAiMove(game) {
    if (game.over) return null;
    const aiColor = 3 - game.userColor;
    const opponent = game.userColor;
    const candidates = new Set();
    if (!game.history.length) return [7, 7];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (game.grid[y][x] !== 0) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const cx = x + dx, cy = y + dy;
        if (inBounds(game, cx, cy) && game.grid[cy][cx] === 0) candidates.add(`${cx},${cy}`);
      }
    }
    let best = null, bestScore = -Infinity;
    for (const key of candidates) {
      const [x, y] = key.split(',').map(Number);
      game.grid[y][x] = aiColor;
      const attack = hasFive(game, x, y, aiColor) ? 1_000_000 : scoreMove(game, x, y, aiColor);
      game.grid[y][x] = opponent;
      const defense = hasFive(game, x, y, opponent) ? 1_000_000 : scoreMove(game, x, y, opponent);
      game.grid[y][x] = 0;
      const score = attack * 1.03 + defense + (SIZE - Math.abs(7 - x) - Math.abs(7 - y)) * 0.01;
      if (score > bestScore) { best = [x, y]; bestScore = score; }
    }
    if (best) return best;
    let nearest = null, distance = Infinity;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (game.grid[y][x] === 0) {
      const d = Math.abs(7 - x) + Math.abs(7 - y);
      if (d < distance) { nearest = [x, y]; distance = d; }
    }
    return nearest;
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


