import type {
  GameTheme,
  GameThemeOption,
  GameThemeSelection,
  GameThemeVariants,
} from "@/components/games/types";

/**
 * Slots coloreables de FROGGER — inventario completo del engine
 * (`components/games/frogger/engine.ts`). Todas las superficies del juego son
 * color plano dibujado en canvas: no hay sprites PNG, así que nada queda fuera
 * de la paleta.
 *
 * `background` (contrato base) = relleno inicial del canvas bajo las zonas.
 * `grid` (contrato base) = separadores horizontales de carril; `"transparent"`
 * los desactiva (así es en `clasico`/`dark`, donde el engine original no los
 * dibujaba).
 */
export interface FroggerTheme extends GameTheme {
  /** Franja superior con las 5 bocas. */
  goalZone: string;
  /** Bloque del río (filas 1-6). */
  river: string;
  /** Franjas seguras: descanso central y línea de salida. */
  safe: string;
  /** Bloque de carretera (filas 8-12). */
  road: string;
  /** Los tres colores de carrocería de coche, en orden de rotación. */
  cars: [string, string, string];
  /** Ruedas de los coches. */
  carWheel: string;
  /** Caja del camión. */
  truckBody: string;
  /** Cabina del camión. */
  truckCab: string;
  /** Cuerpo del tronco. */
  log: string;
  /** Vetas verticales del tronco. */
  logGrain: string;
  /** Caparazón de tortuga emergida. */
  turtleShell: string;
  /** Anillo interior del caparazón. */
  turtleShellInner: string;
  /** Contorno de tortuga sumergida (letal). */
  turtleSubmerged: string;
  /** Interior de cada boca. */
  goalSlot: string;
  /** Marco de cada boca. */
  goalBorder: string;
  /** Rana posada en una boca ya conquistada. */
  goalFilled: string;
  /** Cuerpo y patas de la rana. */
  frog: string;
  /** Esclerótica de los ojos. */
  frogEye: string;
  /** Pupilas. */
  frogPupil: string;
  /** Barra de tiempo con más del 50% restante. */
  timerHigh: string;
  /** Barra de tiempo entre el 25% y el 50%. */
  timerMid: string;
  /** Barra de tiempo por debajo del 25%. */
  timerLow: string;
  /** Marcador y etiqueta de nivel dibujados en canvas. */
  hudText: string;
  /** Sombra bajo el texto del HUD. */
  hudTextShadow: string;
  /** Puntos de vidas restantes. */
  hudLife: string;
}

/**
 * `clasico`/`dark` == paleta original del engine, hex por hex. No debe cambiar
 * nunca: es el render por defecto.
 */
export const FROGGER_THEMES: Record<string, GameThemeVariants<FroggerTheme>> = {
  clasico: {
    id: "clasico",
    label: "Clásico",
    dark: {
      id: "clasico",
      mode: "dark",
      background: "#000000",
      grid: "transparent",
      goalZone: "#0d3320",
      river: "#001f3a",
      safe: "#123d1f",
      road: "#111111",
      cars: ["#ff3b3b", "#ffd23b", "#3b7bff"],
      carWheel: "#111",
      truckBody: "#8a8a8a",
      truckCab: "#555555",
      log: "#7a4a23",
      logGrain: "rgba(0,0,0,0.25)",
      turtleShell: "#2fae5a",
      turtleShellInner: "#1c7a3d",
      turtleSubmerged: "rgba(0,255,136,0.35)",
      goalSlot: "#0d3320",
      goalBorder: "#d4af37",
      goalFilled: "#3ddc84",
      frog: "#3ddc84",
      frogEye: "#ffffff",
      frogPupil: "#111111",
      timerHigh: "#3ddc84",
      timerMid: "#f5ff00",
      timerLow: "#ff3b3b",
      hudText: "#ffffff",
      hudTextShadow: "rgba(0,0,0,0.8)",
      hudLife: "#3ddc84",
    },
    light: {
      id: "clasico",
      mode: "light",
      background: "#e8e8f2",
      grid: "rgba(20,20,50,0.14)",
      goalZone: "#bfe3c8",
      river: "#bcd8f5",
      safe: "#cfe9c4",
      road: "#d8d8de",
      cars: ["#c21f1f", "#8a6a00", "#1240a8"],
      carWheel: "#2a2a2a",
      truckBody: "#6f6f78",
      truckCab: "#3d3d45",
      log: "#8a5a2b",
      logGrain: "rgba(0,0,0,0.25)",
      turtleShell: "#2f7a45",
      turtleShellInner: "#14532b",
      turtleSubmerged: "rgba(0,90,50,0.45)",
      goalSlot: "#bfe3c8",
      goalBorder: "#8a6a00",
      goalFilled: "#137a40",
      frog: "#137a40",
      frogEye: "#ffffff",
      frogPupil: "#111111",
      timerHigh: "#1f8a4d",
      timerMid: "#8a6a00",
      timerLow: "#c21f1f",
      hudText: "#101018",
      hudTextShadow: "rgba(255,255,255,0.8)",
      hudLife: "#137a40",
    },
  },
  neon: {
    id: "neon",
    label: "Neón",
    dark: {
      id: "neon",
      mode: "dark",
      background: "#05060a",
      grid: "rgba(0,245,255,0.10)",
      goalZone: "#0a2430",
      river: "#04121f",
      safe: "#071f2b",
      road: "#0a0a12",
      cars: ["#ff2ea6", "#f5ff00", "#00f5ff"],
      carWheel: "#12121a",
      truckBody: "#8a5cff",
      truckCab: "#4b2fb0",
      log: "#ffa14a",
      logGrain: "rgba(0,0,0,0.35)",
      turtleShell: "#39ff88",
      turtleShellInner: "#0f9d4f",
      turtleSubmerged: "rgba(57,255,136,0.35)",
      goalSlot: "#0a2430",
      goalBorder: "#f5ff00",
      goalFilled: "#00f5ff",
      frog: "#39ff88",
      frogEye: "#ffffff",
      frogPupil: "#05060a",
      timerHigh: "#39ff88",
      timerMid: "#f5ff00",
      timerLow: "#ff2ea6",
      hudText: "#e8f9ff",
      hudTextShadow: "rgba(0,0,0,0.85)",
      hudLife: "#39ff88",
    },
    light: {
      id: "neon",
      mode: "light",
      background: "#eef0ff",
      grid: "rgba(0,80,160,0.16)",
      goalZone: "#d6f2ea",
      river: "#d9e6ff",
      safe: "#dff5e4",
      road: "#e2e2ee",
      cars: ["#c2005a", "#7a6a00", "#005f8f"],
      carWheel: "#2a2a3a",
      truckBody: "#5b3fbf",
      truckCab: "#33207a",
      log: "#a35a00",
      logGrain: "rgba(0,0,0,0.25)",
      turtleShell: "#00808f",
      turtleShellInner: "#004a55",
      turtleSubmerged: "rgba(0,110,120,0.45)",
      goalSlot: "#d6f2ea",
      goalBorder: "#7a6a00",
      goalFilled: "#c2005a",
      frog: "#046b52",
      frogEye: "#ffffff",
      frogPupil: "#101018",
      timerHigh: "#046b52",
      timerMid: "#7a6a00",
      timerLow: "#c2005a",
      hudText: "#0a0a1a",
      hudTextShadow: "rgba(255,255,255,0.8)",
      hudLife: "#046b52",
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
      goalZone: "#241400",
      river: "#160c00",
      safe: "#1e1000",
      road: "#120a00",
      cars: ["#ffb000", "#ff8c00", "#ffd899"],
      carWheel: "#140b00",
      truckBody: "#c98a1e",
      truckCab: "#7a5200",
      log: "#a86a10",
      logGrain: "rgba(0,0,0,0.35)",
      turtleShell: "#ffcf70",
      turtleShellInner: "#8a5a00",
      turtleSubmerged: "rgba(255,176,0,0.30)",
      goalSlot: "#241400",
      goalBorder: "#ffd899",
      goalFilled: "#ffb000",
      frog: "#ffcf70",
      frogEye: "#fff4dd",
      frogPupil: "#0d0700",
      timerHigh: "#ffb000",
      timerMid: "#ffd899",
      timerLow: "#ff6a00",
      hudText: "#ffe4b3",
      hudTextShadow: "rgba(0,0,0,0.85)",
      hudLife: "#ffb000",
    },
    light: {
      id: "retro",
      mode: "light",
      background: "#f5ead2",
      grid: "rgba(120,86,20,0.18)",
      goalZone: "#e6d3a8",
      river: "#e8dcbe",
      safe: "#e2d6ae",
      road: "#ded2b4",
      cars: ["#8a3b00", "#5c4400", "#7a2f10"],
      carWheel: "#2b1c00",
      truckBody: "#7a6a4a",
      truckCab: "#4a3c20",
      log: "#6b4415",
      logGrain: "rgba(0,0,0,0.25)",
      turtleShell: "#8a6a1e",
      turtleShellInner: "#4a3600",
      turtleSubmerged: "rgba(90,62,0,0.45)",
      goalSlot: "#e6d3a8",
      goalBorder: "#7a5200",
      goalFilled: "#5c3a00",
      frog: "#4a2600",
      frogEye: "#fff8e8",
      frogPupil: "#1a0f00",
      timerHigh: "#5c3a00",
      timerMid: "#8a6a1e",
      timerLow: "#8a3b00",
      hudText: "#2b1c00",
      hudTextShadow: "rgba(255,248,232,0.8)",
      hudLife: "#4a2600",
    },
  },
};

export const FROGGER_THEME_OPTIONS: GameThemeOption[] = Object.values(
  FROGGER_THEMES,
).map((variants) => ({ id: variants.id, label: variants.label }));

export const FROGGER_DEFAULT_SELECTION: GameThemeSelection = {
  themeId: "clasico",
  mode: "dark",
};

export function resolveFroggerTheme(
  selection?: GameThemeSelection,
): FroggerTheme {
  const active = selection ?? FROGGER_DEFAULT_SELECTION;
  const variants = FROGGER_THEMES[active.themeId] ?? FROGGER_THEMES.clasico;
  return active.mode === "light" ? variants.light : variants.dark;
}
