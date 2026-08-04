"use client";

import { useEffect, useRef } from "react";
import {
  createTetrisEngine,
  type TetrisEngine,
} from "@/components/games/caida/engine";
import type { PlayableGameProps } from "@/components/games/types";

export default function CaidaCanvas({
  paused,
  onScoreChange,
  onLinesChange,
  onLevelChange,
  onGameOver,
}: PlayableGameProps) {
  const boardCanvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TetrisEngine | null>(null);

  useEffect(() => {
    const boardCanvas = boardCanvasRef.current;
    const nextCanvas = nextCanvasRef.current;
    if (!boardCanvas || !nextCanvas) return;

    const noop = () => {};
    const engine = createTetrisEngine(boardCanvas, nextCanvas, {
      onScoreChange,
      onLinesChange: onLinesChange ?? noop,
      onLevelChange: onLevelChange ?? noop,
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
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={boardCanvasRef}
        width={300}
        height={600}
        style={{
          height: "100%",
          width: "auto",
          display: "block",
          margin: "0 auto",
        }}
      />
      <canvas
        ref={nextCanvasRef}
        width={120}
        height={120}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 72,
          height: 72,
        }}
      />
    </div>
  );
}
