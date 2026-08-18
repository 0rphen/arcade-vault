import { notFound } from "next/navigation";
import { getGameById, getGames } from "@/lib/supabase/queries";
import { getCurrentProfile } from "@/lib/auth/user";
import GamePlayer from "@/components/game-player";

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((g) => ({ id: g.id }));
}

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, profile] = await Promise.all([
    getGameById(id),
    getCurrentProfile(),
  ]);

  if (!game) notFound();

  return (
    <GamePlayer game={game} initialName={profile?.nickname ?? "INVITADO"} />
  );
}
