import GamesFeatureShell from "@/components/games/GamesFeatureShell";

type GamesSubPageShellProps = {
  gameTitle: string;
};

export default function GamesSubPageShell({ gameTitle }: GamesSubPageShellProps) {
  return (
    <GamesFeatureShell title={gameTitle}>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-600 md:text-base">
        Game setup in progress. Check back soon for the full experience.
      </p>
    </GamesFeatureShell>
  );
}
