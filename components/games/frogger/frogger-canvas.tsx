"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createFroggerEngine,
  FROGGER_CANVAS_H,
  FROGGER_CANVAS_W,
  type FroggerEngine,
} from "@/components/games/frogger/engine";
import { resolveFroggerTheme } from "@/components/games/frogger/themes";
import type { PlayableGameProps } from "@/components/games/types";

export default function FroggerCanvas({
  paused,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
  theme,
}: PlayableGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FroggerEngine | null>(null);

  const palette = useMemo(() => resolveFroggerTheme(theme), [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const noop = () => {};
    const engine = createFroggerEngine(
      canvas,
      {
        onScoreChange,
        onLivesChange: onLivesChange ?? noop,
        onLevelChange: onLevelChange ?? noop,
        onGameOver,
      },
      palette,
    );
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setTheme(palette);
  }, [palette]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (paused) engine.pause();
    else engine.resume();
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      width={FROGGER_CANVAS_W}
      height={FROGGER_CANVAS_H}
      style={{
        width: "100%",
        height: "auto",
        maxHeight: "100%",
        objectFit: "contain",
        display: "block",
        margin: "0 auto",
        background: palette.background,
      }}
    />
  );
}
