import { notFound } from "next/navigation";
import { getGameById } from "@/lib/supabase/queries";
import { getCurrentProfile } from "@/lib/auth/user";
import GamePlayer from "@/components/game-player";

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

  return <GamePlayer game={game} nickname={profile?.nickname ?? null} />;
}
