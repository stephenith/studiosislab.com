import Image from "next/image";
import Link from "next/link";
import GameTile from "@/components/games/GameTile";
import {
  BreakoutThumb,
  MemoryMatchThumb,
  SnakeThumb,
  TicTacToeThumb,
} from "@/components/games/GameThumbs";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import HomeHeaderAuth from "@/components/HomeHeaderAuth";

const GAMES = [
  {
    title: "Tic Tac Toe",
    description: "Classic Xs and Os—quick rounds, perfect for a short break.",
    href: "/games/tic-tac-toe",
    Thumb: TicTacToeThumb,
  },
  {
    title: "Snake",
    description: "Steer the line, eat the dots, and try not to crash into yourself.",
    href: "/games/snake",
    Thumb: SnakeThumb,
  },
  {
    title: "Memory Match",
    description: "Flip cards and find pairs—calm focus, simple rules.",
    href: "/games/memory-match",
    Thumb: MemoryMatchThumb,
  },
  {
    title: "Breakout",
    description: "Bounce the ball and clear the wall—arcade energy, minimal chrome.",
    href: "/games/breakout",
    Thumb: BreakoutThumb,
  },
] as const;

export default function GamesPage() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-white px-5 pt-5">
      <NoiseBackground />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-1 pb-4 sm:px-2">
          <Link href="/" className="relative block h-11 w-[min(100%,280px)] shrink-0">
            <Image
              src={HOME_LOGOS_LIGHT.header}
              alt="Studiosis Lab — home"
              fill
              className="object-contain object-left"
              sizes="280px"
              priority
            />
          </Link>
          <HomeHeaderAuth />
        </header>

        <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-14 pt-2 sm:px-6 sm:pt-4">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-semibold font-heading tracking-tight text-zinc-900 md:text-4xl">
              Games
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:mx-0 md:text-base">
              Small browser games built for calm breaks—pick one and play when you are ready.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {GAMES.map((game) => {
              const Thumbnail = game.Thumb;
              return (
                <GameTile
                  key={game.href}
                  title={game.title}
                  description={game.description}
                  href={game.href}
                  thumb={<Thumbnail />}
                />
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
