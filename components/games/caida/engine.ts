import {
  resolveCaidaTheme,
  type CaidaPieceColors,
  type CaidaTheme,
} from "@/components/games/caida/themes";

// Port of references/started-games/03-tetris/game.js — encapsulated,
// no module-level globals, so multiple mount/unmount cycles stay isolated.

export interface TetrisCallbacks {
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface TetrisEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Cambia la paleta activa y repinta el frame actual, sin reiniciar la partida. */
  setTheme: (theme: CaidaTheme) => void;
  destroy: () => void;
}

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const NEXT_BLOCK = 30;

/** Índice de pieza (1..8) → slot de paleta. Ver COLORS original en el port. */
const PIECE_SLOTS: (keyof CaidaPieceColors)[] = [
  "i", // 1 - I
  "o", // 2 - O
  "t", // 3 - T
  "s", // 4 - S
  "z", // 5 - Z
  "j", // 6 - J
  "l", // 7 - L
  "n", // 8 - N (tuerca)
];

function pieceColor(theme: CaidaTheme, colorIndex: number): string | null {
  const slot = PIECE_SLOTS[colorIndex - 1];
  return slot ? theme.pieces[slot] : null;
}

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const CAPTURED_CODES = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyX",
  "Space",
]);

type Board = number[][];
type Shape = number[][];

interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const template = PIECES[type];
  if (!template) throw new Error(`Unknown piece type ${type}`);
  const shape = template.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function collide(board: Board, shape: Shape, ox: number, oy: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () =>
    new Array(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function ghostY(board: Board, piece: Piece): number {
  let gy = piece.y;
  while (!collide(board, piece.shape, piece.x, gy + 1)) gy++;
  return gy;
}

export function createTetrisEngine(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
  initialTheme?: CaidaTheme,
): TetrisEngine {
  const ctx = boardCanvas.getContext("2d");
  const nextCtx = nextCanvas.getContext("2d");
  if (!ctx || !nextCtx) throw new Error("2D context not available on canvas");

  let theme: CaidaTheme = initialTheme ?? resolveCaidaTheme();

  // ── Input ───────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    if (isPaused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(board, current.shape, current.x - 1, current.y))
          current.x--;
        break;
      case "ArrowRight":
        if (!collide(board, current.shape, current.x + 1, current.y))
          current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
    emitHud();
  };

  // ── Estado ──────────────────────────────────────────────────────────────
  let board: Board;
  let current: Piece;
  let next: Piece;
  let score: number;
  let lines: number;
  let level: number;
  let dropInterval: number;
  let dropAccum: number;
  let gameOver: boolean;

  let lastEmittedScore = -1;
  let lastEmittedLines = -1;
  let lastEmittedLevel = -1;
  let gameOverEmitted = false;

  function emitHud() {
    if (score !== lastEmittedScore) {
      lastEmittedScore = score;
      callbacks.onScoreChange(score);
    }
    if (lines !== lastEmittedLines) {
      lastEmittedLines = lines;
      callbacks.onLinesChange(lines);
    }
    if (level !== lastEmittedLevel) {
      lastEmittedLevel = level;
      callbacks.onLevelChange(level);
    }
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(board, rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function hardDrop() {
    const gy = ghostY(board, current);
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(board, current.shape, current.x, current.y)) {
      endGame();
    }
    drawNext();
  }

  function endGame() {
    gameOver = true;
    if (!gameOverEmitted) {
      gameOverEmitted = true;
      callbacks.onGameOver(score);
    }
  }

  // ── Draw ────────────────────────────────────────────────────────────────
  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ) {
    if (!colorIndex) return;
    const color = pieceColor(theme, colorIndex);
    if (!color) return;
    context.globalAlpha = alpha ?? 1;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = theme.blockHighlight;
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid() {
    ctx!.strokeStyle = theme.grid;
    ctx!.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx!.beginPath();
      ctx!.moveTo(c * BLOCK, 0);
      ctx!.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx!.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx!.beginPath();
      ctx!.moveTo(0, r * BLOCK);
      ctx!.lineTo(COLS * BLOCK, r * BLOCK);
      ctx!.stroke();
    }
  }

  function draw() {
    ctx!.fillStyle = theme.background;
    ctx!.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx!, c, r, board[r][c], BLOCK);

    const gy = ghostY(board, current);
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx!,
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            theme.ghostAlpha,
          );

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          ctx!,
          current.x + c,
          current.y + r,
          current.shape[r][c],
          BLOCK,
        );
  }

  function drawNext() {
    nextCtx!.fillStyle = theme.nextBackground;
    nextCtx!.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx!, offX + c, offY + r, shape[r][c], NEXT_BLOCK);
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropAccum = 0;
    gameOver = false;
    gameOverEmitted = false;
    lastEmittedScore = -1;
    lastEmittedLines = -1;
    lastEmittedLevel = -1;
    next = randomPiece();
    spawn();
    emitHud();
  }

  // ── Loop principal ──────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let isPaused = false;
  let started = false;

  function loop(ts: number) {
    if (isPaused) return;
    const dt = lastTime === null ? 0 : ts - lastTime;
    lastTime = ts;

    if (!gameOver) {
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(board, current.shape, current.x, current.y + 1)) {
          current.y++;
        } else {
          lockPiece();
        }
      }
      emitHud();
    }

    if (gameOver) return;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    window.addEventListener("keydown", onKeyDown);
    initGame();
    started = true;
    isPaused = false;
    lastTime = null;
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function pause() {
    if (isPaused) return;
    isPaused = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function resume() {
    if (!isPaused || gameOver) return;
    isPaused = false;
    lastTime = null;
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function destroy() {
    isPaused = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    window.removeEventListener("keydown", onKeyDown);
  }

  function setTheme(nextTheme: CaidaTheme) {
    theme = nextTheme;
    if (!started) return;
    draw();
    drawNext();
  }

  return { start, pause, resume, setTheme, destroy };
}
