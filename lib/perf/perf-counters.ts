/**
 * Contadores mutables a nivel de módulo, fuera del ciclo de render de React.
 * `game-player.tsx` y los wrappers de juego los incrementan; `perf-overlay.tsx`
 * los lee en cada frame de su propio rAF. No usan estado de React porque
 * incrementarían exactamente el churn de renders que se quiere medir.
 */
export interface PerfCounters {
  /** Re-renders de GamePlayer desde el montaje. */
  renders: number;
  /** Llamadas a `engine.setTheme()` cuya paleta no cambió respecto a la anterior. */
  redundantSetTheme: number;
}

const counters: PerfCounters = { renders: 0, redundantSetTheme: 0 };

export function recordRender() {
  counters.renders += 1;
}

export function recordRedundantSetTheme() {
  counters.redundantSetTheme += 1;
}

export function getPerfCounters(): PerfCounters {
  return counters;
}

export function resetPerfCounters() {
  counters.renders = 0;
  counters.redundantSetTheme = 0;
}
