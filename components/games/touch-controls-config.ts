export interface TouchControlsConfig {
  /** Qué flechas del D-pad están activas para este juego, y qué `code` de teclado disparan. */
  dpad: {
    up?: string; // ej. "ArrowUp"
    down?: string;
    left?: string;
    right?: string;
  };
  /** Botón de acción único, opcional. Ausente = el juego no muestra botón de acción. */
  action?: {
    code: string; // ej. "Space"
    label: string; // ej. "DISPARO", "CAÍDA RÁPIDA"
  };
}

export const TOUCH_CONTROLS_CONFIG: Record<string, TouchControlsConfig> = {
  rocas: {
    dpad: { up: "ArrowUp", left: "ArrowLeft", right: "ArrowRight" },
    action: { code: "Space", label: "DISPARO" },
  },
  caida: {
    dpad: {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
    },
    action: { code: "Space", label: "CAÍDA RÁPIDA" },
  },
  arkanoid: {
    dpad: { left: "ArrowLeft", right: "ArrowRight" },
  },
  snake: {
    dpad: {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
    },
  },
};
