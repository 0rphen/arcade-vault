"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createArkanoidEngine,
  type ArkanoidEngine,
} from "@/components/games/arkanoid/engine";
import { resolveArkanoidTheme } from "@/components/games/arkanoid/themes";
import type { PlayableGameProps } from "@/components/games/types";

export default function ArkanoidCanvas({
  paused,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
  onResumeRequested,
  theme,
}: PlayableGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ArkanoidEngine | null>(null);

  const palette = useMemo(() => resolveArkanoidTheme(theme), [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const noop = () => {};
    const engine = createArkanoidEngine(
      canvas,
      {
        onScoreChange,
        onLivesChange: onLivesChange ?? noop,
        onLevelChange: onLevelChange ?? noop,
        onGameOver,
        onResumeRequested: onResumeRequested ?? noop,
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
      width={800}
      height={600}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        background: palette.background,
      }}
    />
  );
}
