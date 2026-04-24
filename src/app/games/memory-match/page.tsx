import GamesFeatureShell from "@/components/games/GamesFeatureShell";
import MemoryMatchGame from "@/components/games/MemoryMatchGame";

export default function MemoryMatchPage() {
  return (
    <GamesFeatureShell title="Memory Match">
      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 md:text-base">
        Find all eight pairs. Tap two cards at a time to reveal numbers.
      </p>
      <MemoryMatchGame />
    </GamesFeatureShell>
  );
}
