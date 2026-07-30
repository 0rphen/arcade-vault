import { notFound } from "next/navigation";
import { GAMES, seededScores } from "@/lib/data";
import GameDetail from "@/components/game-detail";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);

  if (!game) notFound();

  const scores = seededScores(id.length * 17 + 3, 10);

  return <GameDetail game={game} scores={scores} />;
}
