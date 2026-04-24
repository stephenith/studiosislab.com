import GamesFeatureShell from "@/components/games/GamesFeatureShell";
import SnakeGame from "@/components/games/SnakeGame";

export default function SnakePage() {
  return (
    <GamesFeatureShell title="Snake">
      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 md:text-base">
        Eat the light squares, avoid walls and yourself. Use arrow keys to steer.
      </p>
      <SnakeGame />
    </GamesFeatureShell>
  );
}
