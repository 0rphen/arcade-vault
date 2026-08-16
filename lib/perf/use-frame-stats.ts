"use client";

import { useEffect, useRef, useState } from "react";
import { getPerfCounters } from "@/lib/perf/perf-counters";

export interface FrameStats {
  fps: number; // media móvil de 1 s
  p95FrameMs: number; // percentil 95 sobre ventana de 5 s
  worstFrameMs: number;
  renders: number; // re-renders del host desde el montaje
}

const FPS_WINDOW_MS = 1000;
const P95_WINDOW_MS = 5000;

const EMPTY_STATS: FrameStats = {
  fps: 0,
  p95FrameMs: 0,
  worstFrameMs: 0,
  renders: 0,
};

/**
 * rAF propio, agnóstico de cualquier engine: mide el presupuesto real del
 * hilo principal muestreando `performance.now()` frame a frame, sin tocar
 * ningún `engine.ts`.
 */
export function useFrameStats(): FrameStats {
  const [stats, setStats] = useState<FrameStats>(EMPTY_STATS);
  const samplesRef = useRef<{ t: number; dt: number }[]>([]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      const samples = samplesRef.current;
      samples.push({ t: now, dt });
      const cutoff = now - P95_WINDOW_MS;
      while (samples.length && samples[0].t < cutoff) samples.shift();

      const fpsWindowStart = now - FPS_WINDOW_MS;
      const fpsSamples = samples.filter((s) => s.t >= fpsWindowStart);
      const avgDt =
        fpsSamples.length > 0
          ? fpsSamples.reduce((sum, s) => sum + s.dt, 0) / fpsSamples.length
          : 0;
      const fps = avgDt > 0 ? 1000 / avgDt : 0;

      const sortedDts = samples.map((s) => s.dt).sort((a, b) => a - b);
      const p95Index = Math.min(
        sortedDts.length - 1,
        Math.floor(sortedDts.length * 0.95),
      );
      const p95FrameMs = sortedDts.length ? sortedDts[p95Index] : 0;
      const worstFrameMs = sortedDts.length
        ? sortedDts[sortedDts.length - 1]
        : 0;

      setStats({
        fps,
        p95FrameMs,
        worstFrameMs,
        renders: getPerfCounters().renders,
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return stats;
}
