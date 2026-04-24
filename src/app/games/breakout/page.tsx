import GamesFeatureShell from "@/components/games/GamesFeatureShell";
import BreakoutGame from "@/components/games/BreakoutGame";

export default function BreakoutPage() {
  return (
    <GamesFeatureShell title="Breakout">
      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 md:text-base">
        Clear every brick. Move the paddle with the arrow keys and keep the ball in play.
      </p>
      <BreakoutGame />
    </GamesFeatureShell>
  );
}
