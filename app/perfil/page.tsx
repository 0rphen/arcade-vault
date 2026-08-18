import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/user";
import { signOutAction } from "@/lib/auth/actions";
import NicknameForm from "@/components/nickname-form";

export default async function PerfilPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/auth");

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">MI PERFIL</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            {profile.email}
          </div>
        </div>

        <NicknameForm nickname={profile.nickname} />

        <form action={signOutAction}>
          <button
            className="btn ghost"
            type="submit"
            style={{ width: "100%", marginTop: 18 }}
          >
            CERRAR SESIÓN
          </button>
        </form>
      </div>
    </div>
  );
}
