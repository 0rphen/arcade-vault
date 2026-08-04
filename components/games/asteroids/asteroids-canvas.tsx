"use client";

import { useEffect, useRef } from "react";
import {
  createAsteroidsEngine,
  type AsteroidsEngine,
} from "@/components/games/asteroids/engine";
import type { PlayableGameProps } from "@/components/games/types";

export default function AsteroidsCanvas({
  paused,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onTripleShotChange,
  onGameOver,
}: PlayableGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const noop = () => {};
    const engine = createAsteroidsEngine(canvas, {
      onScoreChange,
      onLivesChange: onLivesChange ?? noop,
      onLevelChange: onLevelChange ?? noop,
      onTripleShotChange: onTripleShotChange ?? noop,
      onGameOver,
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
