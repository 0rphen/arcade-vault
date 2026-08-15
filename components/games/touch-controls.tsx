"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { TouchControlsConfig } from "@/components/games/touch-controls-config";

export interface TouchControlsProps {
  config: TouchControlsConfig;
  /** Deshabilita D-pad/acción sin ocultar el bloque (se usa cuando paused === true). */
  disabled: boolean;
  onPauseToggle: () => void;
  paused: boolean;
}

function dispatchKey(code: string, type: "keydown" | "keyup") {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

export default function TouchControls({
  config,
  disabled,
  onPauseToggle,
  paused,
}: TouchControlsProps) {
  const press = (code: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dispatchKey(code, "keydown");
  };

  const release =
    (code: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (disabled) return;
      dispatchKey(code, "keyup");
    };

  const { dpad, action } = config;

  return (
    <div className="touch-controls">
      <div className="touch-dpad">
        {dpad.up && (
          <button
            type="button"
            className="touch-btn touch-dpad-up"
            aria-label="Arriba"
            onPointerDown={press(dpad.up)}
            onPointerUp={release(dpad.up)}
            onPointerCancel={release(dpad.up)}
            onPointerLeave={release(dpad.up)}
          >
            ▲
          </button>
        )}
        {dpad.left && (
          <button
            type="button"
            className="touch-btn touch-dpad-left"
            aria-label="Izquierda"
            onPointerDown={press(dpad.left)}
            onPointerUp={release(dpad.left)}
            onPointerCancel={release(dpad.left)}
            onPointerLeave={release(dpad.left)}
          >
            ◀
          </button>
        )}
        {dpad.right && (
          <button
            type="button"
            className="touch-btn touch-dpad-right"
            aria-label="Derecha"
            onPointerDown={press(dpad.right)}
            onPointerUp={release(dpad.right)}
            onPointerCancel={release(dpad.right)}
            onPointerLeave={release(dpad.right)}
          >
            ▶
          </button>
        )}
        {dpad.down && (
          <button
            type="button"
            className="touch-btn touch-dpad-down"
            aria-label="Abajo"
            onPointerDown={press(dpad.down)}
            onPointerUp={release(dpad.down)}
            onPointerCancel={release(dpad.down)}
            onPointerLeave={release(dpad.down)}
          >
            ▼
          </button>
        )}
      </div>

      {action && (
        <button
          type="button"
          className="touch-btn touch-action"
          aria-label={action.label}
          onPointerDown={press(action.code)}
          onPointerUp={release(action.code)}
          onPointerCancel={release(action.code)}
          onPointerLeave={release(action.code)}
        >
          {action.label}
        </button>
      )}

      <button
        type="button"
        className="touch-btn touch-pause"
        aria-label={paused ? "Reanudar" : "Pausa"}
        onClick={onPauseToggle}
      >
        {paused ? "▶" : "❚❚"}
      </button>
    </div>
  );
}
