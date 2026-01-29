"use client";

type EditorLayoutProps = {
  topbar?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
};

export default function EditorLayout({
  topbar,
  sidebar,
  children,
}: EditorLayoutProps) {
  return (
    <div className="h-screen w-full flex flex-col bg-gray-100">
      <div className="h-14 shrink-0 sticky top-0 z-50 border-b bg-white">
        {topbar}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r bg-white">
          {sidebar}
        </aside>

        <main className="flex-1 overflow-auto bg-zinc-100 p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
