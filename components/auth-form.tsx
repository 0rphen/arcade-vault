"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  signInAction,
  signInWithOAuthAction,
  signUpAction,
  type OAuthProvider,
} from "@/lib/auth/actions";

export default function AuthForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthPending, startOAuthTransition] = useTransition();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (tab === "up") {
      const result = await signUpAction(email, pass, nickname);
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCheckEmail(true);
      return;
    }

    const result = await signInAction(email, pass);
    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }
    router.push("/");
    router.refresh();
  };

  const playAsGuest = () => {
    router.push("/");
  };

  const handleOAuth = (provider: OAuthProvider) => {
    setError(null);
    startOAuthTransition(() => {
      signInWithOAuthAction(provider);
    });
  };

  if (checkEmail) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="mark"></div>
            <h2 className="neon-cyan">REVISA TU CORREO</h2>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-faint)",
                letterSpacing: "0.16em",
                marginTop: 6,
              }}
            >
              CONFIRMACIÓN PENDIENTE
            </div>
          </div>
          <p style={{ color: "var(--ink-dim)", fontSize: 13, lineHeight: 1.6 }}>
            Te enviamos un enlace de confirmación a <strong>{email}</strong>.
            Ábrelo para activar tu cuenta y quedar con la sesión iniciada.
          </p>
          <button
            className="btn ghost"
            style={{ width: "100%", marginTop: 18 }}
            onClick={() => {
              setCheckEmail(false);
              setTab("in");
            }}
          >
            VOLVER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => {
              setTab("in");
              setError(null);
            }}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => {
              setTab("up");
              setError(null);
            }}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              required
            />
          </div>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Nickname</label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="px_kai"
                required
              />
            </div>
          )}
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div
              className="mono"
              style={{ color: "var(--magenta)", fontSize: 12, marginTop: 8 }}
            >
              {error}
            </div>
          )}

          <button
            className="btn lg"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading
              ? "PROCESANDO..."
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR Y JUGAR"}
          </button>
        </form>

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={oauthPending}
            onClick={() => handleOAuth("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={oauthPending}
            onClick={() => handleOAuth("github")}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
