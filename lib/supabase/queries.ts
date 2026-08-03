import { createClient } from "@supabase/supabase-js";
import type { GameCategory, GameColor } from "@/lib/data";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export interface DbGame {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: GameColor;
  plays: string;
}

export interface GameWithBest extends DbGame {
  best: number;
}

export interface DbScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

export async function getGames(): Promise<DbGame[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color, plays")
    .order("title", { ascending: true });

  if (error) throw error;
  return data as DbGame[];
}

export async function getGamesWithBest(): Promise<GameWithBest[]> {
  const supabase = getSupabase();
  const [
    { data: games, error: gamesError },
    { data: scores, error: scoresError },
  ] = await Promise.all([
    supabase
      .from("games")
      .select("id, title, short, long, cat, cover, color, plays")
      .order("title", { ascending: true }),
    supabase.from("scores").select("game_id, score"),
  ]);

  if (gamesError) throw gamesError;
  if (scoresError) throw scoresError;

  const bestByGame = new Map<string, number>();
  for (const row of scores ?? []) {
    const current = bestByGame.get(row.game_id) ?? 0;
    if (row.score > current) bestByGame.set(row.game_id, row.score);
  }

  return (games as DbGame[]).map((g) => ({
    ...g,
    best: bestByGame.get(g.id) ?? 0,
  }));
}

export async function getGameById(id: string): Promise<GameWithBest | null> {
  const supabase = getSupabase();
  const { data: game, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color, plays")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!game) return null;

  const { data: bestRow, error: bestError } = await supabase
    .from("scores")
    .select("score")
    .eq("game_id", id)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bestError) throw bestError;

  return { ...(game as DbGame), best: bestRow?.score ?? 0 };
}

export async function getTopScores(
  gameId: string,
  limit = 12,
): Promise<DbScoreRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    name: row.name,
    score: row.score,
    date: formatDate(row.created_at),
  }));
}

export async function insertScore(entry: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: entry.gameId, name: entry.name, score: entry.score });

  if (error) throw error;
}
