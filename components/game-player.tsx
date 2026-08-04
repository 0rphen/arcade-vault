"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameWithBest } from "@/lib/supabase/queries";
import { appendScore, getStoredUser } from "@/lib/session";
import { saveScoreAction } from "@/lib/actions/scores";
import { PLAYABLE_GAMES } from "@/components/games/registry";

export default function GamePlayer({ game }: { game: GameWithBest }) {
  const router = useRouter();
  const playable = PLAYABLE_GAMES[game.id];
  const hasRealEngine = Boolean(playable);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tripleShot, setTripleShot] = useState(0);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user) setName(user.name);
  }, []);

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

  const endGame = () => setOver(true);
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
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
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
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
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
        <div className="crt-screen">
          {playable ? (
            !over && (
              <playable.Canvas
                paused={paused}
                onScoreChange={setScore}
                onLivesChange={setLives}
                onLevelChange={setLevel}
                onLinesChange={setLines}
                onTripleShotChange={setTripleShot}
                onGameOver={(finalScore: number) => {
                  setScore(finalScore);
                  endGame();
                }}
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
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
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

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={async () => {
                    if (hasRealEngine) {
                      try {
                        setSaveError(false);
                        await saveScoreAction({ gameId: game.id, name, score });
                        setSaved(true);
                      } catch {
                        setSaveError(true);
                      }
                    } else {
                      appendScore({ game: game.id, score, name });
                      setSaved(true);
                    }
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
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
