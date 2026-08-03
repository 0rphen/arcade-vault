import HallOfFame from "@/components/hall-of-fame";
import { getGames } from "@/lib/supabase/queries";

export default async function SalonPage() {
  const games = await getGames();
  return <HallOfFame games={games} />;
}
