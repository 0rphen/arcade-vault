import type {
  GameTheme,
  GameThemeOption,
  GameThemeSelection,
  GameThemeVariants,
} from "@/components/games/types";

/**
 * Slots coloreables de ARKANOID — inventario completo de los literales de
 * color del engine.
 *
 * Fuera de la paleta (arte de spritesheet `/sprites/spritesheet-breakout.png`,
 * no re-tematizable sin assets nuevos): ladrillos (`block_${color}`), pala,
 * bola y los 4 frames de explosión por color.
 */
export interface ArkanoidTheme extends GameTheme {
  /** Texto del HUD dibujado en canvas (score / nivel). */
  hudText: string;
  /** Velo del overlay de fin de partida / victoria. */
  overlayScrim: string;
  /** Texto grande del overlay de fin de partida / victoria. */
  overlayText: string;
  /** Velo del overlay de pausa. */
  pauseScrim: string;
  /** Texto "PAUSA" y "Saltar al nivel:". */
  pauseText: string;
  /** Relleno del botón del nivel actual. */
  levelButtonActive: string;
  /** Relleno de los botones de nivel no activos. */
  levelButtonIdle: string;
  /** Borde de los botones de nivel. */
  levelButtonBorder: string;
  /** Número dentro del botón activo. */
  levelButtonActiveLabel: string;
  /** Número dentro de los botones no activos. */
  levelButtonIdleLabel: string;
}

/**
 * clasico/dark == paleta original del engine, hex por hex
 * (fondo #000, HUD y textos #fff, velos rgba(0,0,0,0.6) / rgba(0,0,0,0.65),
 * botón activo #f0c040 con número #000, botones inactivos #444 con número
 * #fff y borde #fff). `grid` se usa como marco interior del área de juego y
 * vale #000 en este tema: se dibuja sobre el fondo negro, así que el render
 * por defecto queda idéntico píxel a píxel.
 */
export const ARKANOID_THEMES: Record<
  string,
  GameThemeVariants<ArkanoidTheme>
> = {
  clasico: {
    id: "clasico",
    label: "Clásico",
    dark: {
      id: "clasico",
      mode: "dark",
      background: "#000",
      grid: "#000",
      hudText: "#fff",
      overlayScrim: "rgba(0, 0, 0, 0.6)",
      overlayText: "#fff",
      pauseScrim: "rgba(0, 0, 0, 0.65)",
      pauseText: "#fff",
      levelButtonActive: "#f0c040",
      levelButtonIdle: "#444",
      levelButtonBorder: "#fff",
      levelButtonActiveLabel: "#000",
      levelButtonIdleLabel: "#fff",
    },
    light: {
      id: "clasico",
      mode: "light",
      background: "#d7d9e6",
      grid: "#9aa0b8",
      hudText: "#1a1a2e",
      overlayScrim: "rgba(215, 217, 230, 0.78)",
      overlayText: "#1a1a2e",
      pauseScrim: "rgba(215, 217, 230, 0.82)",
      pauseText: "#1a1a2e",
      levelButtonActive: "#8a6400",
      levelButtonIdle: "#c2c6d6",
      levelButtonBorder: "#3c4056",
      levelButtonActiveLabel: "#ffffff",
      levelButtonIdleLabel: "#1a1a2e",
    },
  },
  neon: {
    id: "neon",
    label: "Neón",
    dark: {
      id: "neon",
      mode: "dark",
      background: "#05060a",
      grid: "rgba(0, 245, 255, 0.22)",
      hudText: "#00f5ff",
      overlayScrim: "rgba(2, 6, 16, 0.72)",
      overlayText: "#00f5ff",
      pauseScrim: "rgba(2, 6, 16, 0.78)",
      pauseText: "#ff2fd0",
      levelButtonActive: "#00f5ff",
      levelButtonIdle: "#12233a",
      levelButtonBorder: "#ff2fd0",
      levelButtonActiveLabel: "#05060a",
      levelButtonIdleLabel: "#9fe8ff",
    },
    light: {
      id: "neon",
      mode: "light",
      background: "#dde2f7",
      grid: "rgba(0, 82, 204, 0.35)",
      hudText: "#0b2470",
      overlayScrim: "rgba(221, 226, 247, 0.8)",
      overlayText: "#0b2470",
      pauseScrim: "rgba(221, 226, 247, 0.84)",
      pauseText: "#a4004e",
      levelButtonActive: "#0052cc",
      levelButtonIdle: "#c5ccec",
      levelButtonBorder: "#a4004e",
      levelButtonActiveLabel: "#ffffff",
      levelButtonIdleLabel: "#0b2470",
    },
  },
  retro: {
    id: "retro",
    label: "Retro",
    dark: {
      id: "retro",
      mode: "dark",
      background: "#0d0700",
      grid: "rgba(255, 176, 0, 0.2)",
      hudText: "#ffb000",
      overlayScrim: "rgba(13, 7, 0, 0.72)",
      overlayText: "#ffb000",
      pauseScrim: "rgba(13, 7, 0, 0.78)",
      pauseText: "#ffd24d",
      levelButtonActive: "#ffb000",
      levelButtonIdle: "#3a2600",
      levelButtonBorder: "#ffd24d",
      levelButtonActiveLabel: "#0d0700",
      levelButtonIdleLabel: "#ffcc66",
    },
    light: {
      id: "retro",
      mode: "light",
      background: "#e3d6b4",
      grid: "rgba(90, 60, 0, 0.35)",
      hudText: "#4a2600",
      overlayScrim: "rgba(227, 214, 180, 0.82)",
      overlayText: "#4a2600",
      pauseScrim: "rgba(227, 214, 180, 0.85)",
      pauseText: "#5c3200",
      levelButtonActive: "#6b3f00",
      levelButtonIdle: "#d0c095",
      levelButtonBorder: "#4a2600",
      levelButtonActiveLabel: "#f7efdb",
      levelButtonIdleLabel: "#3c1f00",
    },
  },
};

export const ARKANOID_THEME_OPTIONS: GameThemeOption[] = Object.values(
  ARKANOID_THEMES,
).map((variants) => ({ id: variants.id, label: variants.label }));

export const ARKANOID_DEFAULT_SELECTION: GameThemeSelection = {
  themeId: "clasico",
  mode: "dark",
};

export function resolveArkanoidTheme(
  selection?: GameThemeSelection,
): ArkanoidTheme {
  const active = selection ?? ARKANOID_DEFAULT_SELECTION;
  const variants = ARKANOID_THEMES[active.themeId] ?? ARKANOID_THEMES.clasico;
  return active.mode === "light" ? variants.light : variants.dark;
}
