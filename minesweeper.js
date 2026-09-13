(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Minesweeper = api;
  if (typeof document !== 'undefined') api.mount(document);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const NEIGHBORS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];

  function createGame(rows, cols, mineCount, random = Math.random) {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || mineCount < 0 || mineCount >= rows * cols) {
      throw new RangeError('Invalid board dimensions or mine count');
    }
    return {
      rows, cols, mineCount, status: 'ready', first: null,
      cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ mine: false, adjacent: 0, revealed: false, flagged: false }))),
      random
    };
  }

  function inBounds(game, x, y) { return x >= 0 && y >= 0 && x < game.cols && y < game.rows; }

  function seedMines(game, safeX, safeY) {
    const spots = [];
    for (let y = 0; y < game.rows; y++) for (let x = 0; x < game.cols; x++) {
      if (x !== safeX || y !== safeY) spots.push([x, y]);
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(game.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (const [x, y] of spots.slice(0, game.mineCount)) game.cells[y][x].mine = true;
    for (let y = 0; y < game.rows; y++) for (let x = 0; x < game.cols; x++) {
      if (game.cells[y][x].mine) continue;
      game.cells[y][x].adjacent = NEIGHBORS.reduce((n, [dx, dy]) => n + (inBounds(game, x + dx, y + dy) && game.cells[y + dy][x + dx].mine ? 1 : 0), 0);
    }
    game.first = [safeX, safeY];
  }

  function reveal(game, x, y) {
    if (!inBounds(game, x, y) || (game.status !== 'ready' && game.status !== 'playing')) return false;
    const start = game.cells[y][x];
    if (start.revealed || start.flagged) return false;
    if (game.status === 'ready') { seedMines(game, x, y); game.status = 'playing'; }
    if (start.mine) {
      start.revealed = true;
      for (const row of game.cells) for (const cell of row) if (cell.mine) cell.revealed = true;
      game.status = 'lost';
      return true;
    }
    const queue = [[x, y]];
    while (queue.length) {
      const [cx, cy] = queue.shift();
      const cell = game.cells[cy][cx];
      if (cell.revealed || cell.flagged || cell.mine) continue;
      cell.revealed = true;
      if (cell.adjacent === 0) for (const [dx, dy] of NEIGHBORS) {
        const nx = cx + dx, ny = cy + dy;
        if (inBounds(game, nx, ny) && !game.cells[ny][nx].revealed) queue.push([nx, ny]);
      }
    }
    const safeLeft = game.cells.flat().some(cell => !cell.mine && !cell.revealed);
    if (!safeLeft) game.status = 'won';
    return true;
  }

  function toggleFlag(game, x, y) {
    if (!inBounds(game, x, y) || (game.status !== 'ready' && game.status !== 'playing')) return false;
    const cell = game.cells[y][x];
    if (cell.revealed) return false;
    cell.flagged = !cell.flagged;
    return true;
  }

  function mount(doc) {
    const boardEl = doc.getElementById('mine-board');
    if (!boardEl) return;
    const config = {
      easy: [9, 9, 10], medium: [16, 16, 40], hard: [16, 30, 99]
    };
    let game, mode = 'reveal', seconds = 0, timer = null;
    const level = doc.getElementById('level');
    const status = doc.getElementById('game-status');
    const minesLeft = doc.getElementById('mines-left');
    const clock = doc.getElementById('clock');
    const face = doc.getElementById('face');
    const flagMode = doc.getElementById('flag-mode');

    function stopTimer() { if (timer) clearInterval(timer); timer = null; }
    function startTimer() {
      if (timer || game.status !== 'playing') return;
      timer = setInterval(() => { seconds++; clock.textContent = formatTime(seconds); }, 1000);
    }
    function formatTime(value) { return String(Math.min(value, 999)).padStart(3, '0'); }
    function setStatus() {
      if (game.status === 'won') { status.textContent = '漂亮！全部排查完成'; face.textContent = '😎'; stopTimer(); }
      else if (game.status === 'lost') { status.textContent = '踩到地雷了，再来一局？'; face.textContent = '😵'; stopTimer(); }
      else if (game.status === 'ready') { status.textContent = '选一个格子开始'; face.textContent = '🙂'; }
      else { status.textContent = mode === 'flag' ? '标记模式 · 点击插旗' : '小心排查每一格'; face.textContent = '🙂'; }
    }
    function render() {
      boardEl.replaceChildren();
      boardEl.style.setProperty('--cols', game.cols);
      boardEl.setAttribute('aria-rowcount', game.rows);
      boardEl.setAttribute('aria-colcount', game.cols);
      for (let y = 0; y < game.rows; y++) for (let x = 0; x < game.cols; x++) {
        const cell = game.cells[y][x];
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'cell';
        button.setAttribute('role', 'gridcell');
        button.setAttribute('aria-label', `第 ${y + 1} 行，第 ${x + 1} 列${cell.revealed ? cell.mine ? '，地雷' : cell.adjacent ? `，周围 ${cell.adjacent} 颗地雷` : '，空白' : cell.flagged ? '，已插旗' : '，未揭开'}`);
        if (cell.revealed || (game.status === 'lost' && cell.mine)) {
          button.classList.add('open');
          if (cell.mine) { button.textContent = '✹'; button.classList.add('mine'); }
          else if (cell.adjacent) { button.textContent = cell.adjacent; button.classList.add(`n${cell.adjacent}`); }
        } else if (cell.flagged) {
          button.textContent = '⚑'; button.classList.add('flagged');
        }
        if (game.status === 'lost' && cell.mine && cell !== game.cells[y]?.[x]) button.classList.add('mine');
        button.addEventListener('click', () => act(x, y));
        button.addEventListener('contextmenu', event => { event.preventDefault(); if (toggleFlag(game, x, y)) { startTimer(); render(); setStatus(); } });
        boardEl.append(button);
      }
      minesLeft.textContent = formatTime(Math.max(0, game.mineCount - game.cells.flat().filter(cell => cell.flagged).length));
      clock.textContent = formatTime(seconds);
      setStatus();
    }
    function act(x, y) {
      if (game.status === 'won' || game.status === 'lost') return;
      if (mode === 'flag') toggleFlag(game, x, y); else reveal(game, x, y);
      startTimer();
      render();
    }
    function reset() {
      stopTimer(); seconds = 0; mode = 'reveal';
      flagMode.setAttribute('aria-pressed', 'false');
      flagMode.classList.remove('active');
      const [rows, cols, mines] = config[level.value];
      game = createGame(rows, cols, mines);
      render();
    }
    level.addEventListener('change', reset);
    doc.getElementById('new-game').addEventListener('click', reset);
    face.addEventListener('click', reset);
    flagMode.addEventListener('click', () => {
      mode = mode === 'flag' ? 'reveal' : 'flag';
      flagMode.setAttribute('aria-pressed', String(mode === 'flag'));
      flagMode.classList.toggle('active', mode === 'flag');
      setStatus();
    });
    reset();
  }

  return { createGame, reveal, toggleFlag, mount };
});


