import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 5;

export async function checkRateLimit(
  ip: string,
  action: "signin" | "signup",
): Promise<{ allowed: boolean }> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const { count, error } = await supabase
    .from("auth_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("action", action)
    .gte("created_at", since);

  if (error) return { allowed: true };
  return { allowed: (count ?? 0) < MAX_ATTEMPTS };
}

export async function recordAttempt(
  ip: string,
  action: "signin" | "signup",
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("auth_rate_limits").insert({ ip, action });
}
