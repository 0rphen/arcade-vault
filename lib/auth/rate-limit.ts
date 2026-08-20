import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 5;

// Chequea y registra el intento en una sola llamada atómica (función
// Postgres con advisory lock) para evitar un race entre check e insert
// bajo requests concurrentes. Falla cerrado: si el RPC falla, bloquea.
export async function consumeRateLimit(
  ip: string,
  action: "signin" | "signup",
): Promise<{ allowed: boolean }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("auth_rate_limit_attempt", {
    p_ip: ip,
    p_action: action,
    p_max_attempts: MAX_ATTEMPTS,
    p_window_minutes: WINDOW_MINUTES,
  });

  if (error) return { allowed: false };
  return { allowed: data === true };
}
