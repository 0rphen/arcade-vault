/** Botón de acción A/B: la letra en la cara es fija, la acción real va al aria-label. */
export interface TouchButton {
  code: string; // ej. "Space"
  label: string; // ej. "Disparo" — va al aria-label, no a la cara del botón
}

export interface TouchControlsConfig {
  /** Qué flechas del D-pad están activas para este juego, y qué `code` de teclado disparan. */
  dpad: {
    up?: string; // ej. "ArrowUp"
    down?: string;
    left?: string;
    right?: string;
  };
  /** Botones de acción. Slot ausente = ese botón no se renderiza. */
  buttons?: {
    a?: TouchButton;
    b?: TouchButton;
  };
}

export const TOUCH_CONTROLS_CONFIG: Record<string, TouchControlsConfig> = {
  rocas: {
    dpad: { up: "ArrowUp", left: "ArrowLeft", right: "ArrowRight" },
    buttons: { a: { code: "Space", label: "Disparo" } },
  },
  caida: {
    dpad: {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
    },
    buttons: { a: { code: "Space", label: "Caída rápida" } },
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
