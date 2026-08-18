import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface CurrentProfile {
  id: string;
  email: string;
  nickname: string;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  // A valid session must never render as "logged out" just because the
  // profiles row is missing (e.g. the trigger failed) — fall back to a
  // nickname derived from the email instead of hiding the session.
  return {
    id: user.id,
    email: user.email ?? "",
    nickname:
      profile?.nickname ??
      (user.email?.split("@")[0] ?? "PLAYER").toUpperCase(),
  };
}
