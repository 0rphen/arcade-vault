export interface PlayableGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onLinesChange?: (lines: number) => void;
  onTripleShotChange?: (secondsLeft: number) => void;
}
