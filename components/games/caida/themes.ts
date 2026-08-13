import type {
  GameTheme,
  GameThemeOption,
  GameThemeSelection,
  GameThemeVariants,
} from "@/components/games/types";

/** Slots coloreables de CAÍDA — inventario completo del engine. */
export interface CaidaPieceColors {
  i: string;
  o: string;
  t: string;
  s: string;
  z: string;
  j: string;
  l: string;
  n: string;
}

export interface CaidaTheme extends GameTheme {
  /** Fondo del panel de "siguiente pieza". */
  nextBackground: string;
  /** Bisel superior de cada bloque. */
  blockHighlight: string;
  /** Opacidad de la pieza fantasma (proyección de caída). */
  ghostAlpha: number;
  pieces: CaidaPieceColors;
}

/**
 * clasico/dark == paleta original del engine, hex por hex
 * (#4dd0e1 #ffd54f #ba68c8 #81c784 #e57373 #90caf9 #ffb74d #9e9e9e,
 * fondo #000, rejilla rgba(255,255,255,0.06), bisel rgba(255,255,255,0.12),
 * fantasma 0.2). No debe cambiar nunca.
 */
export const CAIDA_THEMES: Record<string, GameThemeVariants<CaidaTheme>> = {
  clasico: {
    id: "clasico",
    label: "Clásico",
    dark: {
      id: "clasico",
      mode: "dark",
      background: "#000",
      nextBackground: "#000",
      grid: "rgba(255,255,255,0.06)",
      blockHighlight: "rgba(255,255,255,0.12)",
      ghostAlpha: 0.2,
      pieces: {
        i: "#4dd0e1",
        o: "#ffd54f",
        t: "#ba68c8",
        s: "#81c784",
        z: "#e57373",
        j: "#90caf9",
        l: "#ffb74d",
        n: "#9e9e9e",
      },
    },
    light: {
      id: "clasico",
      mode: "light",
      background: "#e8e8f2",
      nextBackground: "#e8e8f2",
      grid: "rgba(40,40,80,0.14)",
      blockHighlight: "rgba(0,0,0,0.18)",
      ghostAlpha: 0.35,
      pieces: {
        i: "#00838f",
        o: "#9a7300",
        t: "#7b1fa2",
        s: "#2e7d32",
        z: "#c62828",
        j: "#1565c0",
        l: "#cc5500",
        n: "#5f6368",
      },
    },
  },
  neon: {
    id: "neon",
    label: "Neón",
    dark: {
      id: "neon",
      mode: "dark",
      background: "#05060a",
      nextBackground: "#05060a",
      grid: "rgba(0,245,255,0.12)",
      blockHighlight: "rgba(255,255,255,0.28)",
      ghostAlpha: 0.22,
      pieces: {
        i: "#00f5ff",
        o: "#f5ff00",
        t: "#ff006e",
        s: "#00ff88",
        z: "#ff3355",
        j: "#3d8bff",
        l: "#ff9500",
        n: "#c7d0e0",
      },
    },
    light: {
      id: "neon",
      mode: "light",
      background: "#eef0ff",
      nextBackground: "#eef0ff",
      grid: "rgba(0,80,160,0.16)",
      blockHighlight: "rgba(0,0,0,0.16)",
      ghostAlpha: 0.35,
      pieces: {
        i: "#00808f",
        o: "#8a7a00",
        t: "#c2005a",
        s: "#00873d",
        z: "#d10038",
        j: "#0052cc",
        l: "#c05600",
        n: "#4a5570",
      },
    },
  },
  retro: {
    id: "retro",
    label: "Retro",
    dark: {
      id: "retro",
      mode: "dark",
      background: "#0d0700",
      nextBackground: "#0d0700",
      grid: "rgba(255,176,0,0.10)",
      blockHighlight: "rgba(255,226,170,0.22)",
      ghostAlpha: 0.25,
      pieces: {
        i: "#ffe4b3",
        o: "#ffb000",
        t: "#e08a1e",
        s: "#ffcc66",
        z: "#c46a10",
        j: "#f0a830",
        l: "#ffd24d",
        n: "#b08a5a",
      },
    },
    light: {
      id: "retro",
      mode: "light",
      background: "#f5ead2",
      nextBackground: "#f5ead2",
      grid: "rgba(120,86,20,0.18)",
      blockHighlight: "rgba(0,0,0,0.15)",
      ghostAlpha: 0.35,
      pieces: {
        i: "#7a4b00",
        o: "#a06a00",
        t: "#5c3200",
        s: "#8a5e10",
        z: "#4a2600",
        j: "#6b4a1a",
        l: "#b07800",
        n: "#8a7a66",
      },
    },
  },
};

export const CAIDA_THEME_OPTIONS: GameThemeOption[] = Object.values(
  CAIDA_THEMES,
).map((variants) => ({ id: variants.id, label: variants.label }));

export const CAIDA_DEFAULT_SELECTION: GameThemeSelection = {
  themeId: "clasico",
  mode: "dark",
};

export function resolveCaidaTheme(selection?: GameThemeSelection): CaidaTheme {
  const active = selection ?? CAIDA_DEFAULT_SELECTION;
  const variants = CAIDA_THEMES[active.themeId] ?? CAIDA_THEMES.clasico;
  return active.mode === "light" ? variants.light : variants.dark;
}
