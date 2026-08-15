"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { TouchControlsConfig } from "@/components/games/touch-controls-config";
import type { GameThemeSelection } from "@/components/games/types";

export interface TouchControlsProps {
  config: TouchControlsConfig;
  /** Deshabilita D-pad/acción sin ocultar el bloque (se usa cuando paused === true). */
  disabled: boolean;
  onPauseToggle: () => void;
  paused: boolean;
  /** Tema activo del juego. Ausente → "clasico"/"dark". */
  theme?: GameThemeSelection;
}

const CODE_TO_KEY: Record<string, string> = {
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Space: " ",
};

function dispatchKey(code: string, type: "keydown" | "keyup") {
  const key = CODE_TO_KEY[code] ?? code;
  window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true }));
}

export default function TouchControls({
  config,
  disabled,
  onPauseToggle,
  paused,
  theme,
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
      dispatchKey(code, "keyup");
    };

  const { dpad, buttons } = config;
  const themeId = theme?.themeId ?? "clasico";
  const themeMode = theme?.mode ?? "dark";

  return (
    <div
      className="gp"
      role="group"
      aria-label="Gamepad"
      data-gp-theme={themeId}
      data-gp-mode={themeMode}
    >
      <div className="gp-body">
        <div className="gp-col gp-col-left">
          <div className="gp-dpad" aria-label="D-pad">
            {dpad.up && (
              <button
                type="button"
                disabled={disabled}
                className={`dp dp-up${disabled ? " gp-off" : ""}`}
                aria-label="Arriba"
                onPointerDown={press(dpad.up)}
                onPointerUp={release(dpad.up)}
                onPointerCancel={release(dpad.up)}
                onPointerLeave={release(dpad.up)}
              >
                <svg className="dp-arrow" viewBox="0 0 24 24">
                  <path d="M12 4 L20 16 L4 16 Z" fill="currentColor" />
                </svg>
              </button>
            )}
            {dpad.right && (
              <button
                type="button"
                disabled={disabled}
                className={`dp dp-right${disabled ? " gp-off" : ""}`}
                aria-label="Derecha"
                onPointerDown={press(dpad.right)}
                onPointerUp={release(dpad.right)}
                onPointerCancel={release(dpad.right)}
                onPointerLeave={release(dpad.right)}
              >
                <svg className="dp-arrow" viewBox="0 0 24 24">
                  <path d="M8 4 L20 12 L8 20 Z" fill="currentColor" />
                </svg>
              </button>
            )}
            {dpad.down && (
              <button
                type="button"
                disabled={disabled}
                className={`dp dp-down${disabled ? " gp-off" : ""}`}
                aria-label="Abajo"
                onPointerDown={press(dpad.down)}
                onPointerUp={release(dpad.down)}
                onPointerCancel={release(dpad.down)}
                onPointerLeave={release(dpad.down)}
              >
                <svg className="dp-arrow" viewBox="0 0 24 24">
                  <path d="M4 8 L20 8 L12 20 Z" fill="currentColor" />
                </svg>
              </button>
            )}
            {dpad.left && (
              <button
                type="button"
                disabled={disabled}
                className={`dp dp-left${disabled ? " gp-off" : ""}`}
                aria-label="Izquierda"
                onPointerDown={press(dpad.left)}
                onPointerUp={release(dpad.left)}
                onPointerCancel={release(dpad.left)}
                onPointerLeave={release(dpad.left)}
              >
                <svg className="dp-arrow" viewBox="0 0 24 24">
                  <path d="M16 4 L16 20 L4 12 Z" fill="currentColor" />
                </svg>
              </button>
            )}
            <div className="dp-hub" aria-hidden="true">
              <span className="dp-hub-gem"></span>
            </div>
          </div>
        </div>

        {buttons && (buttons.a || buttons.b) && (
          <div className="gp-col gp-col-right">
            <div className="gp-actions">
              {buttons.b && (
                <button
                  type="button"
                  disabled={disabled}
                  className={`ab b${disabled ? " gp-off" : ""}`}
                  aria-label={buttons.b.label}
                  onPointerDown={press(buttons.b.code)}
                  onPointerUp={release(buttons.b.code)}
                  onPointerCancel={release(buttons.b.code)}
                  onPointerLeave={release(buttons.b.code)}
                >
                  <span className="ab-ring"></span>
                  <span className="ab-letter">B</span>
                </button>
              )}
              {buttons.a && (
                <button
                  type="button"
                  disabled={disabled}
                  className={`ab a${disabled ? " gp-off" : ""}`}
                  aria-label={buttons.a.label}
                  onPointerDown={press(buttons.a.code)}
                  onPointerUp={release(buttons.a.code)}
                  onPointerCancel={release(buttons.a.code)}
                  onPointerLeave={release(buttons.a.code)}
                >
                  <span className="ab-ring"></span>
                  <span className="ab-letter">A</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="gp-start"
        aria-label={paused ? "Reanudar" : "Pausa"}
        onClick={onPauseToggle}
      >
        START
      </button>
    </div>
  );
}
