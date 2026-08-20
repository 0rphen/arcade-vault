"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { mapAuthError } from "@/lib/auth/errors";

export type AuthActionResult = { error: string | null };
export type OAuthProvider = "google" | "github";

const RATE_LIMIT_MESSAGE =
  "Demasiados intentos. Esperá unos minutos e intentá de nuevo.";

const NICKNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
const NICKNAME_ERROR_MESSAGE =
  "El nickname debe tener 3–20 caracteres, solo letras, números, guion o guion bajo.";

async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function signUpAction(
  email: string,
  password: string,
  nickname: string,
): Promise<AuthActionResult> {
  if (!NICKNAME_REGEX.test(nickname)) {
    return { error: NICKNAME_ERROR_MESSAGE };
  }

  const ip = await getClientIp();
  const { allowed } = await consumeRateLimit(ip, "signup");
  if (!allowed) return { error: RATE_LIMIT_MESSAGE };

  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nickname },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) return { error: mapAuthError(error) };
  return { error: null };
}

export async function signInAction(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const ip = await getClientIp();
  const { allowed } = await consumeRateLimit(ip, "signin");
  if (!allowed) return { error: RATE_LIMIT_MESSAGE };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { error: mapAuthError(error) };
  return { error: null };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function signInWithOAuthAction(
  provider: OAuthProvider,
): Promise<void> {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) redirect("/auth");

  redirect(data.url);
}

export async function updateNicknameAction(
  nickname: string,
): Promise<AuthActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No hay sesión activa." };

  const { error } = await supabase
    .from("profiles")
    .update({ nickname })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Ese nickname ya está en uso." };
    }
    return { error: mapAuthError(error) };
  }

  revalidatePath("/", "layout");
  return { error: null };
}
