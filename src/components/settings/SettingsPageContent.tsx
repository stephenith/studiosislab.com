"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import HomeHeaderAuth from "@/components/HomeHeaderAuth";
import NoiseBackground from "@/components/home/NoiseBackground";
import { HOME_LOGOS_LIGHT } from "@/components/home/homeLogoAssets";
import { useAuth } from "@/lib/useAuth";

const SHELL_TEXT = "text-zinc-900";
const MUTED_TEXT = "text-zinc-600";
const CARD_CLASS =
  "rounded-2xl border border-zinc-200/90 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6";

function initialsFromUser(name: string | null | undefined, email: string | null | undefined) {
  const base = (name || email || "User").trim();
  return base
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

export default function SettingsPageContent() {
  const { user, authReady } = useAuth();

  const accountBody = useMemo(() => {
    if (!authReady) {
      return (
        <div className="space-y-3" aria-busy>
          <div className="h-4 w-40 animate-pulse rounded-md bg-zinc-100" />
          <div className="h-4 w-56 animate-pulse rounded-md bg-zinc-100" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-zinc-100" />
        </div>
      );
    }
    if (!user) {
      return <p className={`text-sm ${MUTED_TEXT}`}>Sign in to view your account details.</p>;
    }
    const name = user.displayName?.trim() || "—";
    const email = user.email?.trim() || "—";
    const uid = user.uid;
    const photo = user.photoURL;

    return (
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex shrink-0 justify-center sm:justify-start">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-20 w-20 rounded-full border border-zinc-200 object-cover shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-lg font-semibold text-zinc-800 shadow-sm"
              aria-hidden
            >
              {initialsFromUser(user.displayName, user.email)}
            </div>
          )}
        </div>
        <dl className="min-w-0 flex-1 space-y-3 text-left text-sm">
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wide ${MUTED_TEXT}`}>Name</dt>
            <dd className={`mt-0.5 font-medium ${SHELL_TEXT}`}>{name}</dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wide ${MUTED_TEXT}`}>Email</dt>
            <dd className={`mt-0.5 break-all ${SHELL_TEXT}`}>{email}</dd>
          </div>
          <div>
            <dt className={`text-xs font-medium uppercase tracking-wide ${MUTED_TEXT}`}>UID</dt>
            <dd className={`mt-0.5 break-all font-mono text-xs ${SHELL_TEXT}`}>{uid}</dd>
          </div>
        </dl>
      </div>
    );
  }, [authReady, user]);

  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-white px-5 pt-5">
      <NoiseBackground />
      <div className={`relative z-10 flex min-h-0 flex-1 flex-col ${SHELL_TEXT}`}>
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

        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-4 pb-16 pt-2 text-center sm:pt-4">
          <div className="relative mb-6 flex h-40 w-full max-w-[280px] shrink-0 items-center justify-center sm:mb-8 sm:h-48 sm:max-w-[336px]">
            <Image
              src={HOME_LOGOS_LIGHT.heroLab}
              alt="Studiosis Lab"
              fill
              className="object-contain object-center"
              sizes="(max-width: 768px) 90vw, 336px"
              priority
            />
          </div>

          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">Settings</h1>
          <div className="mt-3 h-px w-16 bg-zinc-300" aria-hidden />

          <div className="mt-10 w-full max-w-md space-y-6 text-left">
            <section className={CARD_CLASS}>
              <h2 className={`text-xs font-semibold uppercase tracking-wide ${MUTED_TEXT}`}>Account</h2>
              <div className="mt-4">{accountBody}</div>
            </section>

            <section className={CARD_CLASS}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className={`text-xs font-semibold uppercase tracking-wide ${MUTED_TEXT}`}>Appearance</h2>
                <span
                  className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500"
                  aria-hidden
                >
                  Coming soon
                </span>
              </div>
              <p className={`mt-3 text-sm ${MUTED_TEXT}`}>
                Light and dark mode preferences will be available soon.
              </p>
            </section>

            <section className={CARD_CLASS}>
              <h2 className={`text-xs font-semibold uppercase tracking-wide ${MUTED_TEXT}`}>More (soon)</h2>
              <ul className={`mt-4 space-y-2 text-sm ${MUTED_TEXT}`}>
                <li className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-zinc-500/25 px-3 py-2">
                  <span>Profile photo</span>
                  <span className="shrink-0 text-xs opacity-70">Later</span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-zinc-500/25 px-3 py-2">
                  <span>Phone number</span>
                  <span className="shrink-0 text-xs opacity-70">Later</span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-zinc-500/25 px-3 py-2">
                  <span>Account preferences</span>
                  <span className="shrink-0 text-xs opacity-70">Later</span>
                </li>
              </ul>
            </section>

            <div className="pt-2 text-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
