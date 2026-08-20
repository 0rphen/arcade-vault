import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

const EMAIL_OTP_TYPES: EmailOtpType[] = [
  "email",
  "recovery",
  "invite",
  "magiclink",
  "signup",
  "email_change",
];

function safeOtpType(type: string | null): EmailOtpType | null {
  return EMAIL_OTP_TYPES.includes(type as EmailOtpType)
    ? (type as EmailOtpType)
    : null;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = safeOtpType(searchParams.get("type"));
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Default Supabase email template uses {{ .ConfirmationURL }}, which goes
  // through /auth/v1/verify and redirects here with a PKCE `code` instead of
  // `token_hash`/`type`.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/auth?error=${encodeURIComponent("Enlace de confirmación inválido o expirado.")}`,
  );
}
