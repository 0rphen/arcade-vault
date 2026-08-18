"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GameWithBest } from "@/lib/supabase/queries";
import { appendScore } from "@/lib/session";
import { saveScoreAction } from "@/lib/actions/scores";
import { PLAYABLE_GAMES } from "@/components/games/registry";
import type { GameThemeMode } from "@/components/games/types";
import TouchControls from "@/components/games/touch-controls";
import { TOUCH_CONTROLS_CONFIG } from "@/components/games/touch-controls-config";
import PerfOverlay from "@/components/games/perf-overlay";
import { recordRender } from "@/lib/perf/perf-counters";

const themeStorageKey = (gameId: string) => `arcade-vault:${gameId}:theme`;
const modeStorageKey = (gameId: string) => `arcade-vault:${gameId}:mode`;

export default function GamePlayer({
  game,
  nickname,
}: {
  game: GameWithBest;
  nickname: string | null;
}) {
  recordRender();
  const router = useRouter();
  const playable = PLAYABLE_GAMES[game.id];
  const hasRealEngine = Boolean(playable);
  const themeOptions = playable?.themes;
  const touchConfig = TOUCH_CONTROLS_CONFIG[game.id];
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [themeId, setThemeId] = useState<string>(
    () => themeOptions?.[0]?.id ?? "clasico",
  );
  const [themeMode, setThemeMode] = useState<GameThemeMode>("dark");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tripleShot, setTripleShot] = useState(0);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [perfEnabled, setPerfEnabled] = useState(false);

  useEffect(() => {
    setPerfEnabled(
      new URLSearchParams(window.location.search).get("perf") === "1",
    );
  }, []);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Lee las preferencias persistidas (sistema externo) una vez montado:
  // no se pueden leer en el render inicial sin desincronizar la hidratación.
  useEffect(() => {
    if (!themeOptions) return;
    const storedTheme = window.localStorage.getItem(themeStorageKey(game.id));
    if (storedTheme && themeOptions.some((t) => t.id === storedTheme)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeId(storedTheme);
    }
    const storedMode = window.localStorage.getItem(modeStorageKey(game.id));
    if (storedMode === "light" || storedMode === "dark") {
      setThemeMode(storedMode);
    }
  }, [game.id, themeOptions]);

  const chooseTheme = (id: string) => {
    setThemeId(id);
    window.localStorage.setItem(themeStorageKey(game.id), id);
  };
  const chooseMode = (mode: GameThemeMode) => {
    setThemeMode(mode);
    window.localStorage.setItem(modeStorageKey(game.id), mode);
  };

  useEffect(() => {
    if (hasRealEngine || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [hasRealEngine, over, paused]);

  useEffect(() => {
    if (hasRealEngine) return;
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [hasRealEngine, score]);

  const endGame = useCallback(() => setOver(true), []);
  const handleResumeRequested = useCallback(() => setPaused(false), []);
  const handlePauseToggle = useCallback(() => setPaused((p) => !p), []);
  const handleGameOver = useCallback(
    (finalScore: number) => {
      setScore(finalScore);
      endGame();
    },
    [endGame],
  );
  const themeSelection = useMemo(
    () => (themeOptions ? { themeId, mode: themeMode } : undefined),
    [themeOptions, themeId, themeMode],
  );
  const restart = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setLines(0);
    setPaused(false);
    setTripleShot(0);
    setOver(false);
    setSaved(false);
    setSaveError(false);
  };

  return (
    <div className="av-player fade-in">
      {perfEnabled && <PerfOverlay />}
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {nickname ?? "INVITADO"}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          {game.id !== "snake" && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          {game.id !== "snake" && (
            <div className="hud-stat level">
              <div className="l">Nivel</div>
              <div className="v">{String(level).padStart(2, "0")}</div>
            </div>
          )}
          {game.id === "caida" && (
            <div className="hud-stat">
              <div className="l">Líneas</div>
              <div className="v">{lines}</div>
            </div>
          )}
          {tripleShot > 0 && (
            <div className="hud-stat">
              <div className="l">Disparo triple</div>
              <div className="v" style={{ color: "var(--cyan)" }}>
                3x {tripleShot.toFixed(1)}s
              </div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={handlePauseToggle}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/games/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen" data-game={game.id}>
          {playable ? (
            !over && (
              <playable.Canvas
                paused={paused}
                onScoreChange={setScore}
                onLivesChange={setLives}
                onLevelChange={setLevel}
                onLinesChange={setLines}
                onTripleShotChange={setTripleShot}
                onResumeRequested={handleResumeRequested}
                theme={themeSelection}
                onGameOver={handleGameOver}
              />
            )
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{
                background: "rgba(0,0,0,0.6)",
                zIndex: 5,
                pointerEvents: game.id === "arkanoid" ? "none" : "auto",
              }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {touchConfig && isTouchDevice && (
        <TouchControls
          config={touchConfig}
          disabled={paused}
          paused={paused}
          onPauseToggle={handlePauseToggle}
          theme={themeSelection}
        />
      )}

      {themeOptions && (
        <div className="hud-theme">
          <span className="l">Tema</span>
          <select
            aria-label="Tema visual"
            value={themeId}
            onChange={(e) => chooseTheme(e.target.value)}
          >
            {themeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label={
              themeMode === "dark"
                ? "Cambiar a modo claro"
                : "Cambiar a modo oscuro"
            }
            onClick={() => chooseMode(themeMode === "dark" ? "light" : "dark")}
          >
            {themeMode === "dark" ? "◐ OSCURO" : "◑ CLARO"}
          </button>
        </div>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                {hasRealEngine && !nickname ? (
                  <div
                    className="toast-saved"
                    style={{ color: "var(--ink-dim)" }}
                  >
                    ▸ INICIA SESIÓN PARA GUARDAR TU PUNTAJE —{" "}
                    <Link href="/auth">INICIAR SESIÓN</Link>
                  </div>
                ) : (
                  <button
                    className="btn yellow"
                    onClick={async () => {
                      if (hasRealEngine) {
                        try {
                          setSaveError(false);
                          await saveScoreAction({ gameId: game.id, score });
                          setSaved(true);
                        } catch {
                          setSaveError(true);
                        }
                      } else {
                        appendScore({
                          game: game.id,
                          score,
                          name: nickname ?? "INVITADO",
                        });
                        setSaved(true);
                      }
                    }}
                  >
                    GUARDAR PUNTUACIÓN
                  </button>
                )}
                {saveError && (
                  <div
                    className="toast-saved"
                    style={{ color: "var(--magenta)" }}
                  >
                    ▸ NO SE PUDO GUARDAR, INTENTA DE NUEVO_
                  </div>
                )}
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push("/")}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
