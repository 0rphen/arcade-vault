import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { PlayableGameProps } from "@/components/games/types";

export interface PlayableGameEntry {
  Canvas: ComponentType<PlayableGameProps>;
}

export const PLAYABLE_GAMES: Record<string, PlayableGameEntry> = {
  rocas: {
    Canvas: dynamic(
      () => import("@/components/games/asteroids/asteroids-canvas"),
      { ssr: false },
    ),
  },
  caida: {
    Canvas: dynamic(() => import("@/components/games/caida/caida-canvas"), {
      ssr: false,
    }),
  },
  arkanoid: {
    Canvas: dynamic(
      () => import("@/components/games/arkanoid/arkanoid-canvas"),
      { ssr: false },
    ),
  },
};
