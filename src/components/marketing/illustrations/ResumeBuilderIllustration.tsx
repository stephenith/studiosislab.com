export default function ResumeBuilderIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
      <div className="absolute inset-0 -z-10 rounded-2xl [background-image:radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:18px_18px]" />
      <div className="grid grid-cols-[1fr_1.15fr] gap-4 sm:gap-6">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="h-2 w-20 rounded bg-zinc-300" />
          <div className="mt-3 space-y-2">
            <div className="h-2 rounded bg-zinc-200" />
            <div className="h-2 rounded bg-zinc-200" />
            <div className="h-2 w-4/5 rounded bg-zinc-200" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="h-10 rounded border border-zinc-200 bg-white" />
            <div className="h-10 rounded border border-zinc-200 bg-white" />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="h-2 w-24 rounded bg-zinc-300" />
            <div className="h-5 w-14 rounded-full border border-zinc-200 bg-zinc-50" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-2 rounded bg-zinc-200" />
            <div className="h-2 rounded bg-zinc-200" />
            <div className="h-2 rounded bg-zinc-200" />
            <div className="h-2 w-3/4 rounded bg-zinc-200" />
          </div>
          <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            <div className="h-2 w-16 rounded bg-zinc-300" />
            <div className="mt-2 h-2 rounded bg-zinc-200" />
            <div className="mt-2 h-2 w-5/6 rounded bg-zinc-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
