import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type {
  GameThemeOption,
  PlayableGameProps,
} from "@/components/games/types";
import { CAIDA_THEME_OPTIONS } from "@/components/games/caida/themes";
import { ARKANOID_THEME_OPTIONS } from "@/components/games/arkanoid/themes";
import { SNAKE_THEME_OPTIONS } from "@/components/games/snake/themes";
import { FROGGER_THEME_OPTIONS } from "@/components/games/frogger/themes";

export interface PlayableGameEntry {
  Canvas: ComponentType<PlayableGameProps>;
  /** Si el juego está tematizado, las familias que ofrece al selector del HUD. */
  themes?: GameThemeOption[];
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
    themes: CAIDA_THEME_OPTIONS,
  },
  arkanoid: {
    Canvas: dynamic(
      () => import("@/components/games/arkanoid/arkanoid-canvas"),
      { ssr: false },
    ),
    themes: ARKANOID_THEME_OPTIONS,
  },
  snake: {
    Canvas: dynamic(() => import("@/components/games/snake/snake-canvas"), {
      ssr: false,
    }),
    themes: SNAKE_THEME_OPTIONS,
  },
  frogger: {
    Canvas: dynamic(() => import("@/components/games/frogger/frogger-canvas"), {
      ssr: false,
    }),
    themes: FROGGER_THEME_OPTIONS,
  },
};
