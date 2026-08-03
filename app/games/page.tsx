import Home from "@/components/home";
import { getGames } from "@/lib/supabase/queries";

export default async function GamesPage() {
  const games = await getGames();
  return <Home games={games} />;
}
