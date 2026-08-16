import {
  resolveFroggerTheme,
  type FroggerTheme,
} from "@/components/games/frogger/themes";

export interface FroggerCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface FroggerEngine {
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Cambia la paleta activa y re-pinta el frame actual, sin reiniciar. */
  setTheme: (theme: FroggerTheme) => void;
  destroy: () => void;
}

const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
export const FROGGER_CANVAS_W = COLS * CELL; // 640 — se escala con CSS al contenedor
export const FROGGER_CANVAS_H = ROWS * CELL; // 560
const CANVAS_W = FROGGER_CANVAS_W;
const CANVAS_H = FROGGER_CANVAS_H;

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

const GOAL_COUNT = 5;
const GOAL_WIDTH = 2; // celdas por boca
/** Columna inicial de cada boca; huecos entre ellas actúan como muro letal. */
const GOAL_STARTS = [1, 4, 7, 10, 13];

const ROAD_SPEED_MIN = 2; // cells/sec
const ROAD_SPEED_MAX = 6;
const RIVER_SPEED_MIN = 1.5;
const RIVER_SPEED_MAX = 4.5;
const SPEED_STEP_PER_LEVEL = 0.15; // +15% por nivel

const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;

const MIN_GAP = 1; // celdas libres mínimas entre entidades de un mismo carril

const JUMP_DURATION_MS = 120;
const MAX_DT_MS = 50; // evita saltos de estado si un frame se retrasa (tab en 2do plano, compile stall)
const ROUND_TIME_BASE_MS = 15000;
const ROUND_TIME_MIN_MS = 6000;
const ROUND_TIME_STEP_MS = 1000; // reducción por nivel

const CAPTURED_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

type Direction = "up" | "down" | "left" | "right";

const DIR_VECTORS: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

interface Lane {
  row: number;
  speed: number; // cells/sec, ya escalado por nivel
  dir: 1 | -1;
  entities: Entity[];
}

interface Entity {
  col: number; // posición fraccional en celdas
  width: number; // celdas
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  /** Sólo entidades tipo "turtle": tiempo restante en la fase actual (ms). */
  submergeTimer?: number;
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

function scaledSpeed(min: number, max: number, level: number): number {
  const base = rand(min, max);
  const multiplier = Math.pow(1 + SPEED_STEP_PER_LEVEL, level - 1);
  return base * multiplier;
}

function roundTimeForLevel(level: number): number {
  return Math.max(
    ROUND_TIME_MIN_MS,
    ROUND_TIME_BASE_MS - (level - 1) * ROUND_TIME_STEP_MS,
  );
}

/**
 * Genera las entidades de un carril con huecos garantizados de al menos
 * MIN_GAP celdas, recorriendo el ancho del tablero en un solo barrido.
 */
function placeEntities(
  count: number,
  widthRange: [number, number],
  type: Entity["type"],
): Entity[] {
  const entities: Entity[] = [];
  let col = rand(0, 3);
  for (let i = 0; i < count; i++) {
    const width = randInt(widthRange[0], widthRange[1]);
    entities.push({
      col,
      width,
      type,
      ...(type === "turtle"
        ? { submerged: false, submergeTimer: TURTLE_VISIBLE_MS }
        : {}),
    });
    col += width + rand(MIN_GAP, MIN_GAP + 2.5);
  }
  return entities;
}

function buildRoadLane(row: number, level: number): Lane {
  const dir: 1 | -1 = row % 2 === 0 ? 1 : -1;
  const isTruckLane = row % 3 === 0;
  const entities = isTruckLane
    ? placeEntities(randInt(2, 3), [2, 3], "truck")
    : placeEntities(randInt(2, 4), [1, 1], "car");
  return {
    row,
    dir,
    speed: scaledSpeed(ROAD_SPEED_MIN, ROAD_SPEED_MAX, level),
    entities,
  };
}

function buildRiverLane(row: number, level: number): Lane {
  const dir: 1 | -1 = row % 2 === 0 ? -1 : 1;
  const isTurtleLane = row % 2 === 0;
  const entities = isTurtleLane
    ? placeEntities(randInt(2, 3), [2, 3], "turtle")
    : placeEntities(randInt(2, 3), [2, 4], "log");
  return {
    row,
    dir,
    speed: scaledSpeed(RIVER_SPEED_MIN, RIVER_SPEED_MAX, level),
    entities,
  };
}

function buildLanes(level: number): Lane[] {
  const lanes: Lane[] = [];
  for (let row = ROW_ROAD_TOP; row <= ROW_ROAD_BOT; row++) {
    lanes.push(buildRoadLane(row, level));
  }
  for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++) {
    lanes.push(buildRiverLane(row, level));
  }
  return lanes;
}

function goalIndexForCol(col: number): number | null {
  const c = Math.round(col);
  for (let i = 0; i < GOAL_STARTS.length; i++) {
    if (c >= GOAL_STARTS[i] && c < GOAL_STARTS[i] + GOAL_WIDTH) return i;
  }
  return null;
}

function checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
  const lane = lanes.find((l) => l.row === frog.row);
  if (!lane) return false;
  return lane.entities.some(
    (e) => frog.col >= e.col && frog.col < e.col + e.width,
  );
}

function getSupport(
  frog: Frog,
  lanes: Lane[],
): { entity: Entity; lane: Lane } | null {
  const lane = lanes.find((l) => l.row === frog.row);
  if (!lane) return null;
  for (const e of lane.entities) {
    if (frog.col >= e.col && frog.col < e.col + e.width) {
      if (e.type === "turtle" && e.submerged) return null;
      return { entity: e, lane };
    }
  }
  return null;
}

export function createFroggerEngine(
  canvas: HTMLCanvasElement,
  callbacks: FroggerCallbacks,
  initialTheme: FroggerTheme = resolveFroggerTheme(),
): FroggerEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context not available on canvas");

  let theme: FroggerTheme = initialTheme;

  // ── Estado ──────────────────────────────────────────────────────────────
  let lanes: Lane[];
  let frog: Frog;
  let goals: boolean[];
  let score: number;
  let lives: number;
  let level: number;
  let roundTimer: number;
  let maxRowReached: number;
  let gameOver: boolean;

  let pendingDir: Direction | null = null;
  let lastEmittedScore = -1;
  let gameOverEmitted = false;

  function emitScore() {
    if (score !== lastEmittedScore) {
      lastEmittedScore = score;
      callbacks.onScoreChange(score);
    }
  }

  function resetFrogToStart() {
    const startCol = Math.floor(COLS / 2);
    frog = {
      col: startCol,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: startCol,
      targetRow: ROW_START,
    };
    maxRowReached = ROW_START;
    roundTimer = roundTimeForLevel(level);
  }

  function killFrog() {
    if (gameOver) return;
    lives -= 1;
    callbacks.onLivesChange(lives);
    if (lives <= 0) {
      gameOver = true;
      if (!gameOverEmitted) {
        gameOverEmitted = true;
        callbacks.onGameOver(score);
      }
    } else {
      resetFrogToStart();
    }
  }

  function completeRound() {
    goals.fill(false);
    level += 1;
    lanes = buildLanes(level);
    resetFrogToStart();
    callbacks.onLevelChange(level);
  }

  function resolveGoalArrival() {
    const idx = goalIndexForCol(frog.col);
    if (idx === null || goals[idx]) {
      killFrog();
      return;
    }
    goals[idx] = true;
    score += 50 + Math.floor(roundTimer / 1000) * 10;
    if (goals.every(Boolean)) {
      score += 200;
      completeRound();
    } else {
      resetFrogToStart();
    }
  }

  /** Colisión de carretera / soporte de río para la fila donde descansa la rana. */
  function resolveStanding(dtSec: number | null) {
    if (frog.row >= ROW_ROAD_TOP && frog.row <= ROW_ROAD_BOT) {
      if (checkRoadCollision(frog, lanes)) killFrog();
      return;
    }
    if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
      const support = getSupport(frog, lanes);
      if (!support) {
        killFrog();
        return;
      }
      if (dtSec !== null) {
        frog.col += support.lane.speed * support.lane.dir * dtSec;
        if (frog.col < 0 || frog.col > COLS - 1) killFrog();
      }
    }
  }

  function onLanded() {
    if (frog.row < maxRowReached) {
      score += 10;
      maxRowReached = frog.row;
    }
    if (frog.row === ROW_GOALS) {
      resolveGoalArrival();
    } else {
      resolveStanding(null);
    }
  }

  function tryStartJump(dir: Direction) {
    const vec = DIR_VECTORS[dir];
    const targetCol = frog.col + vec.dc;
    const targetRow = frog.row + vec.dr;
    if (
      targetCol < 0 ||
      targetCol >= COLS ||
      targetRow < 0 ||
      targetRow > ROW_START
    ) {
      return;
    }
    frog.animating = true;
    frog.animT = 0;
    frog.targetCol = targetCol;
    frog.targetRow = targetRow;
  }

  function advanceLaneEntities(dtSec: number) {
    for (const lane of lanes) {
      for (const e of lane.entities) {
        e.col += lane.speed * lane.dir * dtSec;
        if (lane.dir === 1 && e.col > COLS) {
          e.col = -e.width;
        } else if (lane.dir === -1 && e.col + e.width < 0) {
          e.col = COLS;
        }
      }
    }
  }

  function updateTurtleSubmersion(dt: number) {
    for (const lane of lanes) {
      if (lane.row < ROW_RIVER_TOP || lane.row > ROW_RIVER_BOT) continue;
      for (const e of lane.entities) {
        if (e.type !== "turtle" || e.submergeTimer === undefined) continue;
        e.submergeTimer -= dt;
        if (e.submergeTimer <= 0) {
          e.submerged = !e.submerged;
          e.submergeTimer = e.submerged
            ? TURTLE_SUBMERGED_MS
            : TURTLE_VISIBLE_MS;
        }
      }
    }
  }

  function initGame() {
    lives = 3;
    score = 0;
    level = 1;
    lanes = buildLanes(level);
    goals = new Array(GOAL_COUNT).fill(false);
    pendingDir = null;
    gameOver = false;
    gameOverEmitted = false;
    lastEmittedScore = -1;
    resetFrogToStart();
    callbacks.onLivesChange(lives);
    callbacks.onLevelChange(level);
    emitScore();
  }

  function update(dt: number) {
    const dtSec = dt / 1000;

    advanceLaneEntities(dtSec);
    updateTurtleSubmersion(dt);

    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= JUMP_DURATION_MS) {
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        frog.animating = false;
        onLanded();
      }
    } else if (pendingDir) {
      const dir = pendingDir;
      pendingDir = null;
      tryStartJump(dir);
    } else {
      resolveStanding(dtSec);
    }

    if (!gameOver) {
      roundTimer -= dt;
      if (roundTimer <= 0) {
        roundTimer = 0;
        killFrog();
      }
    }

    emitScore();
  }

  // ── Input ───────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    if (isPaused || gameOver) return;
    switch (e.code) {
      case "ArrowUp":
        pendingDir = "up";
        break;
      case "ArrowDown":
        pendingDir = "down";
        break;
      case "ArrowLeft":
        pendingDir = "left";
        break;
      case "ArrowRight":
        pendingDir = "right";
        break;
    }
  };

  // ── Draw ────────────────────────────────────────────────────────────────
  function drawZoneBackgrounds() {
    const c = ctx!;
    c.fillStyle = theme.background;
    c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    c.fillStyle = theme.goalZone;
    c.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);
    c.fillStyle = theme.river;
    c.fillRect(
      0,
      ROW_RIVER_TOP * CELL,
      CANVAS_W,
      (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
    );
    c.fillStyle = theme.safe;
    c.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_W, CELL);
    c.fillStyle = theme.road;
    c.fillRect(
      0,
      ROW_ROAD_TOP * CELL,
      CANVAS_W,
      (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
    );
    c.fillStyle = theme.safe;
    c.fillRect(0, ROW_START * CELL, CANVAS_W, CELL);

    // Separadores de carril: opcionales, ayudan a leer las filas en modo
    // claro. "transparent" (clásico/oscuro) reproduce el render original.
    if (theme.grid !== "transparent") {
      c.strokeStyle = theme.grid;
      c.lineWidth = 1;
      c.beginPath();
      for (let row = 1; row < ROWS; row++) {
        c.moveTo(0, row * CELL + 0.5);
        c.lineTo(CANVAS_W, row * CELL + 0.5);
      }
      c.stroke();
    }
  }

  function drawCar(x: number, y: number, w: number) {
    const c = ctx!;
    c.fillStyle = theme.cars[Math.floor(x / CELL) % theme.cars.length];
    c.fillRect(x + 4, y + 8, w - 8, CELL - 16);
    c.fillStyle = theme.carWheel;
    c.beginPath();
    c.arc(x + 10, y + CELL - 8, 5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x + w - 10, y + CELL - 8, 5, 0, Math.PI * 2);
    c.fill();
  }

  function drawTruck(x: number, y: number, w: number) {
    const c = ctx!;
    c.fillStyle = theme.truckBody;
    c.fillRect(x + 2, y + 6, w - 4, CELL - 12);
    c.fillStyle = theme.truckCab;
    c.fillRect(x + 2, y + 6, Math.min(CELL * 0.6, w - 4), CELL - 12);
  }

  function drawLog(x: number, y: number, w: number) {
    const c = ctx!;
    c.fillStyle = theme.log;
    c.fillRect(x + 2, y + 8, w - 4, CELL - 16);
    c.strokeStyle = theme.logGrain;
    c.lineWidth = 1;
    c.beginPath();
    for (let lx = x + 10; lx < x + w - 4; lx += 10) {
      c.moveTo(lx, y + 8);
      c.lineTo(lx, y + CELL - 8);
    }
    c.stroke();
  }

  function drawTurtle(x: number, y: number, w: number, submerged: boolean) {
    const c = ctx!;
    const count = Math.round(w / CELL);
    for (let i = 0; i < count; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (submerged) {
        c.strokeStyle = theme.turtleSubmerged;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx, cy, CELL / 2 - 6, 0, Math.PI * 2);
        c.stroke();
      } else {
        c.fillStyle = theme.turtleShell;
        c.beginPath();
        c.arc(cx, cy, CELL / 2 - 6, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = theme.turtleShellInner;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(cx, cy, CELL / 2 - 10, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }

  function drawLanes() {
    for (const lane of lanes) {
      for (const e of lane.entities) {
        const x = e.col * CELL;
        const y = lane.row * CELL;
        const w = e.width * CELL;
        if (x + w < 0 || x > CANVAS_W) continue;
        switch (e.type) {
          case "car":
            drawCar(x, y, w);
            break;
          case "truck":
            drawTruck(x, y, w);
            break;
          case "log":
            drawLog(x, y, w);
            break;
          case "turtle":
            drawTurtle(x, y, w, !!e.submerged);
            break;
        }
      }
    }
  }

  function drawGoals() {
    const c = ctx!;
    for (let i = 0; i < GOAL_COUNT; i++) {
      const x = GOAL_STARTS[i] * CELL;
      const y = ROW_GOALS * CELL;
      const w = GOAL_WIDTH * CELL;
      c.fillStyle = theme.goalSlot;
      c.fillRect(x + 2, y + 2, w - 4, CELL - 4);
      c.strokeStyle = theme.goalBorder;
      c.lineWidth = 2;
      c.strokeRect(x + 2, y + 2, w - 4, CELL - 4);
      if (goals[i]) {
        c.fillStyle = theme.goalFilled;
        c.beginPath();
        c.ellipse(x + w / 2, y + CELL / 2, 12, 10, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  function drawFrog() {
    const c = ctx!;
    const t = frog.animating ? frog.animT / JUMP_DURATION_MS : 0;
    const drawCol = frog.animating
      ? frog.col + (frog.targetCol - frog.col) * t
      : frog.col;
    const drawRow = frog.animating
      ? frog.row + (frog.targetRow - frog.row) * t
      : frog.row;
    const cx = drawCol * CELL + CELL / 2;
    const cy = drawRow * CELL + CELL / 2;
    const legSpread = frog.animating ? 6 : 2;

    c.fillStyle = theme.frog;
    c.beginPath();
    c.ellipse(cx - 12 - legSpread, cy + 6, 6, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(cx + 12 + legSpread, cy + 6, 6, 4, 0, 0, Math.PI * 2);
    c.fill();

    c.beginPath();
    c.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = theme.frogEye;
    c.beginPath();
    c.arc(cx - 5, cy - 8, 4, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(cx + 5, cy - 8, 4, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = theme.frogPupil;
    c.beginPath();
    c.arc(cx - 5, cy - 8, 2, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(cx + 5, cy - 8, 2, 0, Math.PI * 2);
    c.fill();
  }

  function drawHud() {
    const c = ctx!;
    const total = roundTimeForLevel(level);
    const ratio = total > 0 ? Math.max(0, roundTimer / total) : 0;
    const barColor =
      ratio > 0.5
        ? theme.timerHigh
        : ratio > 0.25
          ? theme.timerMid
          : theme.timerLow;
    c.fillStyle = barColor;
    c.fillRect(0, 0, CANVAS_W * ratio, 4);

    c.font = "16px monospace";
    c.textBaseline = "top";
    c.shadowColor = theme.hudTextShadow;
    c.shadowBlur = 3;

    c.fillStyle = theme.hudText;
    c.textAlign = "left";
    c.fillText(String(score), 8, 8);

    c.textAlign = "center";
    c.fillText(`NIVEL ${String(level).padStart(2, "0")}`, CANVAS_W / 2, 8);

    c.shadowBlur = 0;
    c.textAlign = "right";
    for (let i = 0; i < lives; i++) {
      c.fillStyle = theme.hudLife;
      c.beginPath();
      c.arc(CANVAS_W - 14 - i * 16, 16, 6, 0, Math.PI * 2);
      c.fill();
    }
    c.shadowColor = "transparent";
  }

  function draw() {
    drawZoneBackgrounds();
    drawLanes();
    drawGoals();
    drawFrog();
    drawHud();
  }

  // ── Loop principal ──────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let isPaused = false;

  function loop(ts: number) {
    if (isPaused) return;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT_MS);
    lastTime = ts;

    if (!gameOver) update(dt);
    if (gameOver) return;

    draw();
    rafId = requestAnimationFrame(loop);
  }

  /** true una vez que initGame() dejó estado dibujable. */
  let ready = false;

  function start() {
    window.addEventListener("keydown", onKeyDown);
    initGame();
    ready = true;
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

  function setTheme(nextTheme: FroggerTheme) {
    theme = nextTheme;
    // Re-pinta el frame actual sin tocar el estado de la partida: cubre
    // también los casos en pausa o game over, donde el loop no dibuja.
    if (ready) draw();
  }

  function destroy() {
    ready = false;
    isPaused = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    window.removeEventListener("keydown", onKeyDown);
  }

  return { start, pause, resume, setTheme, destroy };
}
