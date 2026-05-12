export default function EsignOnlineIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
      <div className="absolute inset-0 -z-10 rounded-2xl [background-image:radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:18px_18px]" />
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-4 sm:gap-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <div className="h-2 w-24 rounded bg-zinc-300" />
          <div className="mt-3 space-y-2">
            <div className="h-2 rounded bg-zinc-200" />
            <div className="h-2 rounded bg-zinc-200" />
            <div className="h-2 w-4/5 rounded bg-zinc-200" />
          </div>
          <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
            <div className="h-2 w-28 rounded bg-zinc-300" />
            <div className="mt-3 h-8 rounded bg-white" />
            <div className="mt-2 h-8 rounded bg-white" />
            <div className="mt-4 flex items-center justify-between">
              <div className="h-2 w-20 rounded bg-zinc-300" />
              <div className="h-6 w-16 rounded-full bg-zinc-900 text-[10px] font-medium text-white grid place-items-center">
                Verified
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="h-2 w-20 rounded bg-zinc-300" />
            <div className="mt-3 h-14 rounded-lg border border-zinc-200 bg-white" />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="h-2 w-16 rounded bg-zinc-300" />
            <div className="mt-3 h-2 rounded bg-zinc-200" />
            <div className="mt-2 h-2 rounded bg-zinc-200" />
            <div className="mt-5 flex items-center gap-2">
              <div className="h-8 w-8 rounded-full border border-zinc-300 bg-zinc-50" />
              <div className="h-2 w-20 rounded bg-zinc-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
