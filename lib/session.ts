const SCORES_KEY = "av_scores";

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

export function appendScore(entry: Omit<SavedScore, "at">): void {
  if (typeof window === "undefined") return;
  try {
    const all: SavedScore[] = JSON.parse(
      localStorage.getItem(SCORES_KEY) || "[]",
    );
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    // ignore malformed storage state, matches prototype's silent-fail behavior
  }
}
