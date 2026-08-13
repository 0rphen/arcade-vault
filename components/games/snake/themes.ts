import type {
  GameTheme,
  GameThemeOption,
  GameThemeSelection,
  GameThemeVariants,
} from "@/components/games/types";

/**
 * Slots coloreables de SNAKE — inventario completo del engine.
 *
 * Fuera de la paleta: las frutas son sprites recortados del atlas
 * `public/games/snake/fruits.png` (ver `sprites.ts`). No se re-tematizan
 * sin assets nuevos; sólo se les puede añadir un halo detrás (`fruitHalo`).
 */
export interface SnakeTheme extends GameTheme {
  /** Cabeza de la serpiente. */
  snakeHead: string;
  /** Resto de segmentos del cuerpo. */
  snakeBody: string;
  /**
   * Halo circular pintado bajo el sprite de fruta para que siga legible
   * sobre fondos claros. `"transparent"` = no se dibuja.
   */
  fruitHalo: string;
}

/**
 * `clasico`/`dark` == paleta original del engine, hex por hex
 * (fondo `#000`, cabeza `#7dffb0`, cuerpo `#3ddc84`, sin rejilla ni halo).
 * No debe cambiar nunca: es el render por defecto.
 */
export const SNAKE_THEMES: Record<string, GameThemeVariants<SnakeTheme>> = {
  clasico: {
    id: "clasico",
    label: "Clásico",
    dark: {
      id: "clasico",
      mode: "dark",
      background: "#000",
      grid: "transparent",
      snakeHead: "#7dffb0",
      snakeBody: "#3ddc84",
      fruitHalo: "transparent",
    },
    light: {
      id: "clasico",
      mode: "light",
      background: "#e8e8f2",
      grid: "rgba(40,40,80,0.14)",
      snakeHead: "#0b5c34",
      snakeBody: "#1f8a4d",
      fruitHalo: "rgba(0,0,0,0.10)",
    },
  },
  neon: {
    id: "neon",
    label: "Neón",
    dark: {
      id: "neon",
      mode: "dark",
      background: "#05060a",
      grid: "rgba(0,245,255,0.12)",
      snakeHead: "#5cffd8",
      snakeBody: "#00e5a0",
      fruitHalo: "rgba(0,245,255,0.18)",
    },
    light: {
      id: "neon",
      mode: "light",
      background: "#eef0ff",
      grid: "rgba(0,80,160,0.16)",
      snakeHead: "#c2005a",
      snakeBody: "#00808f",
      fruitHalo: "rgba(0,0,0,0.10)",
    },
  },
  retro: {
    id: "retro",
    label: "Retro",
    dark: {
      id: "retro",
      mode: "dark",
      background: "#0d0700",
      grid: "rgba(255,176,0,0.10)",
      snakeHead: "#ffe4b3",
      snakeBody: "#ffb000",
      fruitHalo: "rgba(255,176,0,0.15)",
    },
    light: {
      id: "retro",
      mode: "light",
      background: "#f5ead2",
      grid: "rgba(120,86,20,0.18)",
      snakeHead: "#4a2600",
      snakeBody: "#7a4b00",
      fruitHalo: "rgba(0,0,0,0.10)",
    },
  },
};

export const SNAKE_THEME_OPTIONS: GameThemeOption[] = Object.values(
  SNAKE_THEMES,
).map((variants) => ({ id: variants.id, label: variants.label }));

export const SNAKE_DEFAULT_SELECTION: GameThemeSelection = {
  themeId: "clasico",
  mode: "dark",
};

export function resolveSnakeTheme(selection?: GameThemeSelection): SnakeTheme {
  const active = selection ?? SNAKE_DEFAULT_SELECTION;
  const variants = SNAKE_THEMES[active.themeId] ?? SNAKE_THEMES.clasico;
  return active.mode === "light" ? variants.light : variants.dark;
}
