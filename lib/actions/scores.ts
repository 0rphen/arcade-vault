"use server";

import {
  getMyBestScores,
  getTopScores,
  insertScore,
} from "@/lib/supabase/queries";
import type { DbBestScoreRow, DbScoreRow } from "@/lib/supabase/queries";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/user";

export async function getTopScoresAction(
  gameId: string,
  limit = 12,
): Promise<DbScoreRow[]> {
  const user = await getCurrentUser();
  return getTopScores(gameId, limit, user?.id ?? null);
}

export async function getMyBestScoresAction(): Promise<DbBestScoreRow[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return getMyBestScores(user.id);
}

const MAX_SCORE = 999_999;

// ROCAS (spec 05), CAIDA (spec 07), ARKANOID (spec 08), SNAKE (spec 09) and
// FROGGER (game-jam frogger/01) have real game engines; the rest of the
// catalog still uses the simulated player and must stay on localStorage.
const GAMES_WITH_REAL_SCORES = new Set([
  "rocas",
  "caida",
  "arkanoid",
  "snake",
  "frogger",
]);

export async function saveScoreAction(entry: {
  gameId: string;
  score: number;
}): Promise<void> {
  if (!GAMES_WITH_REAL_SCORES.has(entry.gameId)) {
    throw new Error("Invalid game");
  }

  if (
    !Number.isInteger(entry.score) ||
    entry.score < 0 ||
    entry.score > MAX_SCORE
  ) {
    throw new Error("Invalid score");
  }

  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in required");

  await insertScore({
    gameId: entry.gameId,
    score: entry.score,
    name: profile.nickname,
    userId: profile.id,
  });
}
