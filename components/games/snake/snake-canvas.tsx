"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createSnakeEngine,
  type SnakeEngine,
} from "@/components/games/snake/engine";
import { resolveSnakeTheme } from "@/components/games/snake/themes";
import type { PlayableGameProps } from "@/components/games/types";

export default function SnakeCanvas({
  paused,
  onScoreChange,
  onGameOver,
  theme,
}: PlayableGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SnakeEngine | null>(null);

  const palette = useMemo(() => resolveSnakeTheme(theme), [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createSnakeEngine(
      canvas,
      {
        onScoreChange,
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
      width={600}
      height={400}
      style={{
        width: "100%",
        height: "auto",
        maxHeight: "100%",
        display: "block",
        margin: "0 auto",
        background: palette.background,
      }}
    />
  );
}
