import { notFound } from "next/navigation";
import { getGameById, getGames, getTopScores } from "@/lib/supabase/queries";
import GameDetail from "@/components/game-detail";

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((g) => ({ id: g.id }));
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGameById(id);

  if (!game) notFound();

  const scores = await getTopScores(id, 10);

  return <GameDetail game={game} scores={scores} />;
}
