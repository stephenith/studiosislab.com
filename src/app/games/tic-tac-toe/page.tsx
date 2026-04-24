import GamesFeatureShell from "@/components/games/GamesFeatureShell";
import TicTacToeGame from "@/components/games/TicTacToeGame";

export default function TicTacToePage() {
  return (
    <GamesFeatureShell title="Tic Tac Toe">
      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 md:text-base">
        Two players on this device — <span className="font-medium text-zinc-800">X</span> opens, then{" "}
        <span className="font-medium text-zinc-800">O</span>. Tap a square to move.
      </p>
      <TicTacToeGame />
    </GamesFeatureShell>
  );
}
