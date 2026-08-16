"use client";

import { useFrameStats } from "@/lib/perf/use-frame-stats";
import { getPerfCounters } from "@/lib/perf/perf-counters";

/**
 * Overlay de métricas. Solo se monta cuando `game-player.tsx` detecta
 * `?perf=1` en la URL — sin ese query param este componente no existe en el
 * árbol y no corre ningún rAF.
 */
export default function PerfOverlay() {
  const stats = useFrameStats();
  const counters = getPerfCounters();

  return (
    <div
      className="mono"
      data-testid="perf-overlay"
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 999,
        padding: "8px 10px",
        background: "rgba(0, 0, 0, 0.78)",
        color: "#0f0",
        fontSize: 11,
        lineHeight: 1.5,
        borderRadius: 4,
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    >
      {`FPS: ${stats.fps.toFixed(1)}
p95: ${stats.p95FrameMs.toFixed(1)} ms
peor: ${stats.worstFrameMs.toFixed(1)} ms
renders: ${stats.renders}
setTheme redundante: ${counters.redundantSetTheme}`}
    </div>
  );
}
