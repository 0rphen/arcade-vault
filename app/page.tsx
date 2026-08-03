import Library from "@/components/library";
import { getGamesWithBest } from "@/lib/supabase/queries";

export default async function Home() {
  const games = await getGamesWithBest();
  return <Library games={games} />;
}
