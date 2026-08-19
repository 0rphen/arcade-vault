"use client";

import { useState } from "react";

const MAX_POKEMON_ID = 1025;

function spriteUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

export default function PokedexContadorPage() {
  const [count, setCount] = useState(1);

  const pokemonId = ((count - 1) % MAX_POKEMON_ID) + 1;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--pixel)",
          fontSize: "1.5rem",
          color: "var(--cyan)",
          textShadow: "0 0 8px var(--cyan)",
        }}
      >
        Contador Pokédex
      </h1>

      <div
        style={{
          fontFamily: "var(--pixel)",
          fontSize: "3rem",
          color: "var(--yellow)",
          textShadow: "0 0 12px var(--yellow)",
        }}
      >
        {count}
      </div>

      <img
        key={pokemonId}
        src={spriteUrl(pokemonId)}
        alt={`Pokémon #${pokemonId}`}
        width={280}
        height={280}
        style={{
          imageRendering: "pixelated",
          filter: "drop-shadow(0 0 16px var(--cyan))",
        }}
      />

      <div style={{ display: "flex", gap: "1rem" }}>
        <button
          type="button"
          className="btn ghost"
          onClick={() => setCount((c) => Math.max(1, c - 1))}
        >
          − Decrementar
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setCount((c) => c + 1)}
        >
          + Incrementar
        </button>
      </div>
    </main>
  );
}
