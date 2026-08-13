/** Variante clara u oscura de una paleta de juego. */
export type GameThemeMode = "dark" | "light";

/**
 * Contrato base de paleta compartido por todos los juegos tematizados.
 * Cada juego lo extiende con sus propios slots (piezas, nave, ladrillos…).
 */
export interface GameTheme {
  /** Familia de tema: "clasico" | "neon" | "retro" | … */
  id: string;
  /** Variante que representa esta paleta concreta. */
  mode: GameThemeMode;
  /** Fondo del canvas. */
  background: string;
  /** Líneas de rejilla / guías dibujadas sobre el fondo. */
  grid: string;
}

/** Las dos variantes (dark/light) de una misma familia de tema. */
export interface GameThemeVariants<TTheme extends GameTheme = GameTheme> {
  id: string;
  label: string;
  dark: TTheme;
  light: TTheme;
}

/** Entrada del selector de temas del HUD. */
export interface GameThemeOption {
  id: string;
  label: string;
}

/** Lo que el HUD envía al juego: qué familia y en qué modo. */
export interface GameThemeSelection {
  themeId: string;
  mode: GameThemeMode;
}

export interface PlayableGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onLinesChange?: (lines: number) => void;
  onTripleShotChange?: (secondsLeft: number) => void;
  onResumeRequested?: () => void;
  /** Tema activo elegido en el HUD. Opcional: los juegos sin temas lo ignoran. */
  theme?: GameThemeSelection;
}
