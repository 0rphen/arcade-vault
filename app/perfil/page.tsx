import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/user";
import { signOutAction } from "@/lib/auth/actions";
import NicknameForm from "@/components/nickname-form";
import { getGames, getMyBestScores } from "@/lib/supabase/queries";

export default async function PerfilPage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/auth");

  const [games, bestScores] = await Promise.all([
    getGames(),
    getMyBestScores(profile.id),
  ]);
  const gameTitle = (gameId: string) =>
    games.find((g) => g.id === gameId)?.title ?? gameId;

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

        <div className="best-scores" style={{ marginTop: 24 }}>
          <div
            className="pixel"
            style={{
              fontSize: 12,
              color: "var(--cyan)",
              letterSpacing: "0.12em",
              marginBottom: 12,
            }}
          >
            MIS MEJORES MARCAS
          </div>
          {bestScores.length === 0 ? (
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--ink-faint)" }}
            >
              Aún no tienes puntajes guardados.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {bestScores.map((row) => (
                <div
                  key={row.gameId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                  }}
                >
                  <span>{gameTitle(row.gameId)}</span>
                  <span style={{ color: "var(--yellow)" }}>
                    {row.score.toLocaleString("es-ES")}
                  </span>
                  <span style={{ color: "var(--ink-faint)" }}>{row.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

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
