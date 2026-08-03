"use server";

import { getTopScores, insertScore } from "@/lib/supabase/queries";
import type { DbScoreRow } from "@/lib/supabase/queries";

export async function getTopScoresAction(
  gameId: string,
  limit?: number,
): Promise<DbScoreRow[]> {
  return getTopScores(gameId, limit);
}

export async function saveScoreAction(entry: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void> {
  await insertScore(entry);
}
