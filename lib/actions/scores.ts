"use server";

import { getTopScores, insertScore } from "@/lib/supabase/queries";
import type { DbScoreRow } from "@/lib/supabase/queries";

export async function getTopScoresAction(
  gameId: string,
  limit?: number,
): Promise<DbScoreRow[]> {
  return getTopScores(gameId, limit);
}

const MAX_SCORE = 999_999;
const MAX_NAME_LENGTH = 10;

export async function saveScoreAction(entry: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void> {
  const name = entry.name.trim().slice(0, MAX_NAME_LENGTH);
  if (!name) throw new Error("Name is required");

  if (
    !Number.isInteger(entry.score) ||
    entry.score < 0 ||
    entry.score > MAX_SCORE
  ) {
    throw new Error("Invalid score");
  }

  await insertScore({ ...entry, name });
}
