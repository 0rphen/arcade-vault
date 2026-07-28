const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export interface AuthUser {
  name: string;
}

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
}

export function appendScore(entry: Omit<SavedScore, "at">): void {
  if (typeof window === "undefined") return;
  try {
    const all: SavedScore[] = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    // ignore malformed storage state, matches prototype's silent-fail behavior
  }
}
