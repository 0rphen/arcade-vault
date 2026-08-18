"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CurrentProfile } from "@/lib/auth/user";

export default function Nav({ profile }: { profile: CurrentProfile | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (
    section: "inicio" | "biblioteca" | "salon" | "about" | "auth",
  ) => {
    if (section === "inicio") return pathname === "/games";
    if (section === "biblioteca")
      return pathname === "/" || pathname.startsWith("/games/");
    if (section === "salon") return pathname === "/salon";
    if (section === "about") return pathname === "/about";
    return pathname === "/auth";
  };

  const closeMenu = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={closeMenu}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/games" className={isActive("inicio") ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/" className={isActive("biblioteca") ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/salon" className={isActive("salon") ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={isActive("about") ? "active" : ""}>
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {profile ? (
          <Link href="/perfil" className="btn ghost auth-btn">
            {profile.nickname} ▾
          </Link>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={closeMenu}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link
          href="/games"
          className={isActive("inicio") ? "active" : ""}
          onClick={closeMenu}
        >
          Inicio
        </Link>
        <Link
          href="/"
          className={isActive("biblioteca") ? "active" : ""}
          onClick={closeMenu}
        >
          Biblioteca
        </Link>
        <Link
          href="/salon"
          className={isActive("salon") ? "active" : ""}
          onClick={closeMenu}
        >
          Salón de la Fama
        </Link>
        <Link
          href="/about"
          className={isActive("about") ? "active" : ""}
          onClick={closeMenu}
        >
          Acerca de
        </Link>
        <Link
          href={profile ? "/perfil" : "/auth"}
          className={isActive("auth") ? "active" : ""}
          onClick={closeMenu}
        >
          {profile ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
