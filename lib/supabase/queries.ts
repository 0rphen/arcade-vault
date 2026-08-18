import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { GameCategory, GameColor } from "@/lib/data";

// Plain client (no cookies): required for reads called from
// generateStaticParams, which runs at build time without a request.
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
  isMine: boolean;
}

export interface DbBestScoreRow {
  gameId: string;
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
    { data: bestRows, error: bestError },
  ] = await Promise.all([
    supabase
      .from("games")
      .select("id, title, short, long, cat, cover, color, plays")
      .order("title", { ascending: true }),
    supabase.from("scores_best").select("game_id, best"),
  ]);

  if (gamesError) throw gamesError;
  if (bestError) throw bestError;

  const bestByGame = new Map<string, number>(
    (bestRows ?? []).map((row) => [row.game_id, row.best]),
  );

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
    .from("scores_best")
    .select("best")
    .eq("game_id", id)
    .maybeSingle();

  if (bestError) throw bestError;

  return { ...(game as DbGame), best: bestRow?.best ?? 0 };
}

export async function getTopScores(
  gameId: string,
  limit = 12,
  currentUserId?: string | null,
): Promise<DbScoreRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at, user_id")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    name: row.name,
    score: row.score,
    date: formatDate(row.created_at),
    isMine: row.user_id != null && row.user_id === currentUserId,
  }));
}

export async function getMyBestScores(
  userId: string,
): Promise<DbBestScoreRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("scores")
    .select("game_id, score, created_at")
    .eq("user_id", userId)
    .order("score", { ascending: false });

  if (error) throw error;

  const bestByGame = new Map<string, DbBestScoreRow>();
  for (const row of data ?? []) {
    if (!bestByGame.has(row.game_id)) {
      bestByGame.set(row.game_id, {
        gameId: row.game_id,
        score: row.score,
        date: formatDate(row.created_at),
      });
    }
  }

  return Array.from(bestByGame.values());
}

// Only invoked from Server Actions (never generateStaticParams), so the
// cookie-aware client is safe here and picks up an authenticated session
// once Supabase Auth lands.
export async function insertScore(entry: {
  gameId: string;
  name: string;
  score: number;
  userId: string;
}): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.gameId,
    name: entry.name,
    score: entry.score,
    user_id: entry.userId,
  });

  if (error) throw error;
}
