import { FRUIT_SPRITES } from "@/components/games/snake/sprites";
import {
  resolveSnakeTheme,
  type SnakeTheme,
} from "@/components/games/snake/themes";

export interface SnakeCallbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface SnakeEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Cambia la paleta y re-pinta el frame actual sin reiniciar la partida. */
  setTheme: (theme: SnakeTheme) => void;
  destroy: () => void;
}

const CELL = 20; // px
const COLS = 30; // 600 / 20
const ROWS = 20; // 400 / 20
const START_LENGTH = 3;
const START_INTERVAL_MS = 150;
const MIN_INTERVAL_MS = 70;
const SPEEDUP_EVERY_FOOD = 4;
const SPEEDUP_STEP_MS = 10;
const POINTS_PER_FRUIT = 10;

const FRUIT_KEYS = Object.keys(FRUIT_SPRITES);

interface Point {
  x: number;
  y: number;
}

interface Direction {
  dx: number;
  dy: number;
}

const UP: Direction = { dx: 0, dy: -1 };
const DOWN: Direction = { dx: 0, dy: 1 };
const LEFT: Direction = { dx: -1, dy: 0 };
const RIGHT: Direction = { dx: 1, dy: 0 };

function isOpposite(a: Direction, b: Direction): boolean {
  return a.dx === -b.dx && a.dy === -b.dy;
}

export function createSnakeEngine(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
  initialTheme?: SnakeTheme,
): SnakeEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context not available on canvas");

  let theme: SnakeTheme = initialTheme ?? resolveSnakeTheme();

  const fruitImage = new Image();
  fruitImage.src = "/games/snake/fruits.png";

  // ── Estado ──────────────────────────────────────────────────────────────
  let snake: Point[];
  let direction: Direction;
  let pendingDirection: Direction | null;
  let fruit: Point;
  let fruitSprite: string;
  let score: number;
  let foodEaten: number;
  let interval: number;
  let gameOver: boolean;

  let lastEmittedScore = -1;
  let gameOverEmitted = false;
  /** El estado de partida no existe hasta el primer initGame(). */
  let ready = false;

  function emitHud() {
    if (score !== lastEmittedScore) {
      lastEmittedScore = score;
      callbacks.onScoreChange(score);
    }
  }

  function randomFreeCell(): Point {
    const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
    let cell: Point;
    do {
      cell = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (occupied.has(`${cell.x},${cell.y}`));
    return cell;
  }

  function spawnFruit() {
    fruit = randomFreeCell();
    fruitSprite = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
  }

  function endGame() {
    gameOver = true;
    if (!gameOverEmitted) {
      gameOverEmitted = true;
      callbacks.onGameOver(score);
    }
  }

  function step() {
    if (pendingDirection && !isOpposite(pendingDirection, direction)) {
      direction = pendingDirection;
    }
    pendingDirection = null;

    const head = snake[0];
    const newHead: Point = {
      x: head.x + direction.dx,
      y: head.y + direction.dy,
    };

    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      endGame();
      return;
    }

    if (snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      endGame();
      return;
    }

    snake.unshift(newHead);

    if (newHead.x === fruit.x && newHead.y === fruit.y) {
      score += POINTS_PER_FRUIT;
      foodEaten++;
      if (foodEaten % SPEEDUP_EVERY_FOOD === 0) {
        interval = Math.max(MIN_INTERVAL_MS, interval - SPEEDUP_STEP_MS);
      }
      spawnFruit();
    } else {
      snake.pop();
    }

    emitHud();
  }

  // ── Input ───────────────────────────────────────────────────────────────
  const CAPTURED_CODES = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    if (isPaused || gameOver) return;
    switch (e.code) {
      case "ArrowUp":
        pendingDirection = UP;
        break;
      case "ArrowDown":
        pendingDirection = DOWN;
        break;
      case "ArrowLeft":
        pendingDirection = LEFT;
        break;
      case "ArrowRight":
        pendingDirection = RIGHT;
        break;
    }
  };

  // ── Draw ────────────────────────────────────────────────────────────────
  function drawGrid() {
    if (theme.grid === "transparent") return;
    ctx!.strokeStyle = theme.grid;
    ctx!.lineWidth = 1;
    ctx!.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx!.moveTo(x * CELL + 0.5, 0);
      ctx!.lineTo(x * CELL + 0.5, canvas.height);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx!.moveTo(0, y * CELL + 0.5);
      ctx!.lineTo(canvas.width, y * CELL + 0.5);
    }
    ctx!.stroke();
  }

  function drawFruitHalo() {
    if (theme.fruitHalo === "transparent") return;
    ctx!.fillStyle = theme.fruitHalo;
    ctx!.beginPath();
    ctx!.arc(
      fruit.x * CELL + CELL / 2,
      fruit.y * CELL + CELL / 2,
      CELL / 2 - 1,
      0,
      Math.PI * 2,
    );
    ctx!.fill();
  }

  function draw() {
    ctx!.fillStyle = theme.background;
    ctx!.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    if (fruitImage.complete && fruitImage.naturalWidth > 0) {
      const sprite = FRUIT_SPRITES[fruitSprite];
      drawFruitHalo();
      ctx!.drawImage(
        fruitImage,
        sprite.x,
        sprite.y,
        sprite.w,
        sprite.h,
        fruit.x * CELL,
        fruit.y * CELL,
        CELL,
        CELL,
      );
    }

    for (let i = 0; i < snake.length; i++) {
      const segment = snake[i];
      ctx!.fillStyle = i === 0 ? theme.snakeHead : theme.snakeBody;
      ctx!.fillRect(
        segment.x * CELL + 1,
        segment.y * CELL + 1,
        CELL - 2,
        CELL - 2,
      );
    }
  }

  function initGame() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    snake = Array.from({ length: START_LENGTH }, (_, i) => ({
      x: cx - i,
      y: cy,
    }));
    direction = RIGHT;
    pendingDirection = null;
    score = 0;
    foodEaten = 0;
    interval = START_INTERVAL_MS;
    gameOver = false;
    gameOverEmitted = false;
    lastEmittedScore = -1;
    spawnFruit();
    ready = true;
    emitHud();
  }

  // ── Loop principal ──────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let isPaused = false;
  let accum = 0;

  function loop(ts: number) {
    if (isPaused) return;
    const dt = lastTime === null ? 0 : ts - lastTime;
    lastTime = ts;

    if (!gameOver) {
      accum += dt;
      if (accum >= interval) {
        accum -= interval;
        step();
      }
    }

    if (gameOver) return;
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    window.addEventListener("keydown", onKeyDown);
    initGame();
    isPaused = false;
    lastTime = null;
    accum = 0;
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

  function setTheme(nextTheme: SnakeTheme) {
    theme = nextTheme;
    // Re-pinta el frame actual sin tocar el estado de la partida: cubre
    // también los casos en pausa o game over, donde el loop no dibuja.
    if (ready) draw();
  }

  function destroy() {
    isPaused = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    window.removeEventListener("keydown", onKeyDown);
  }

  return { start, pause, resume, setTheme, destroy };
}
